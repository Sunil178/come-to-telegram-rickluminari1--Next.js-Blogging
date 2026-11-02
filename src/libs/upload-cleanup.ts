import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { SoftDeleteModel } from "mongoose-delete";
import Post, { type IPost } from "@/models/Post";
import PostRevision from "@/models/PostRevision";
import User, { type IUser } from "@/models/User";
import Upload, { type IUpload } from "@/models/Upload";
import { resolveUploadPath, uploadRoot, UPLOAD_URL_PREFIX } from "@/libs/uploads";
import { escapeRegExp } from "@/libs/search-query";
import { logger } from "@/libs/logger";

const SoftPost = Post as unknown as SoftDeleteModel<IPost>;
const SoftUser = User as unknown as SoftDeleteModel<IUser>;
// Unused files this young may belong to a post still being written, so cleanup leaves them alone.
const GRACE_MS = 24 * 60 * 60 * 1000;
// A local upload address in post content: starts right after a quote, bracket or space, never mid-URL.
const UPLOAD_URL = new RegExp(`(?<=^|["'(\\[\\s])${escapeRegExp(UPLOAD_URL_PREFIX)}/[\\w./-]+\\.(?:jpe?g|png|webp|gif)`, "gi");

/** The upload addresses a post's content refers to. */
export function uploadUrlsIn(text: string | null | undefined): string[] {
    return text?.match(UPLOAD_URL) ?? [];
}

/** Whether any post, earlier revision or profile photo (including soft-deleted ones, which can be restored) uses the file. */
export async function isUploadReferenced(url: string): Promise<boolean> {
    const usedIn = { $or: [{ bannerImage: url }, { content: { $regex: escapeRegExp(url) } }] };
    const [post, revision, avatar] = await Promise.all([
        SoftPost.findOneWithDeleted(usedIn).select("_id").lean(),
        PostRevision.findOne(usedIn).select("_id").lean(),
        SoftUser.findOneWithDeleted({ avatar: url }).select("_id").lean(),
    ]);
    return Boolean(post || revision || avatar);
}

/** Every upload address a post, revision or profile photo uses, gathered in one pass. */
export async function referencedUploads(): Promise<Set<string>> {
    const prefix = new RegExp(`^${escapeRegExp(UPLOAD_URL_PREFIX)}/`);
    const usedIn = { $or: [{ bannerImage: prefix }, { content: { $regex: escapeRegExp(`${UPLOAD_URL_PREFIX}/`) } }] };
    const [posts, revisions, users] = await Promise.all([
        SoftPost.findWithDeleted(usedIn).select("bannerImage content").lean<{ bannerImage?: string; content?: string }[]>(),
        PostRevision.find(usedIn).select("bannerImage content").lean<{ bannerImage?: string; content?: string }[]>(),
        SoftUser.findWithDeleted({ avatar: prefix }).select("avatar").lean<{ avatar?: string }[]>(),
    ]);
    const urls = new Set<string>();
    for (const doc of [...posts, ...revisions]) {
        if (doc.bannerImage) urls.add(doc.bannerImage);
        for (const url of uploadUrlsIn(doc.content)) urls.add(url);
    }
    for (const user of users) if (user.avatar) urls.add(user.avatar);
    return urls;
}

// The file an upload address points at, and the address spelled the one way references use
// (so "/uploads/a//b.png" can't slip past the in-use check for "/uploads/a/b.png").
function locate(url: string): { url: string; target: string } | null {
    if (!url.startsWith(`${UPLOAD_URL_PREFIX}/`)) return null;
    const target = resolveUploadPath(url.slice(UPLOAD_URL_PREFIX.length + 1).split("/"));
    if (!target) return null;
    return { url: `${UPLOAD_URL_PREFIX}/${path.relative(uploadRoot(), target).split(path.sep).join("/")}`, target };
}

async function removeFile(url: string, target: string): Promise<void> {
    await unlink(target).catch((error) => {
        if (error.code !== "ENOENT") throw error;
    });
    await Upload.updateOne({ url }, { $set: { removedAt: new Date() }, $unset: { metadata: 1 } });
}

/** Deletes an uploaded file once nothing uses it any more; anything outside UPLOAD_DIR is left alone. */
export async function removeUploadIfUnused(url: string | null | undefined): Promise<void> {
    const file = url ? locate(url) : null;
    if (!file || (await isUploadReferenced(file.url))) return;
    await removeFile(file.url, file.target).catch((error) => logger.warn("Failed to remove an unused upload", { path: file.target, error }));
}

async function filesOnDisk(): Promise<{ url: string; target: string; size: number; modifiedAt: Date }[]> {
    const root = uploadRoot();
    const entries = await readdir(root, { recursive: true, withFileTypes: true }).catch((error) => {
        if (error.code === "ENOENT") return [];
        throw error;
    });
    const files = entries.filter((entry) => entry.isFile()).flatMap((entry) => {
        const file = locate(`${UPLOAD_URL_PREFIX}/${path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join("/")}`);
        return file ? [file] : [];
    });
    return Promise.all(files.map(async (file) => {
        const info = await stat(file.target);
        return { ...file, size: info.size, modifiedAt: info.mtime };
    }));
}

const isRecent = (modifiedAt: Date) => Date.now() - modifiedAt.getTime() < GRACE_MS;

export interface UploadFile {
    url: string;
    size: number;
    modifiedAt: Date;
    used: boolean;
    // Unused but under a day old: kept, as it may be in a post that isn't saved yet.
    recent: boolean;
    record: (Pick<IUpload, "purpose" | "width" | "height" | "originalSize" | "metadata" | "createdAt"> & { uploader: string | null }) | null;
}

const uploadedAt = (file: UploadFile) => new Date(file.record?.createdAt ?? file.modifiedAt);

/** Every file in UPLOAD_DIR, newest first, with whether anything uses it and who uploaded it (when recorded). */
export async function listUploads(): Promise<UploadFile[]> {
    const files = await filesOnDisk();
    const [used, records] = await Promise.all([
        referencedUploads(),
        Upload.find({ url: { $in: files.map((file) => file.url) } })
            .populate({ path: "userId", model: User, select: "username" })
            .lean<(IUpload & { userId: { username?: string } | null })[]>(),
    ]);
    const byUrl = new Map(records.map((record) => [record.url, record]));
    return files
        .map(({ url, size, modifiedAt }): UploadFile => {
            const record = byUrl.get(url);
            return {
                url,
                size,
                modifiedAt,
                used: used.has(url),
                recent: !used.has(url) && isRecent(modifiedAt),
                record: record
                    ? { purpose: record.purpose, width: record.width, height: record.height, originalSize: record.originalSize, metadata: record.metadata, createdAt: record.createdAt, uploader: record.userId?.username ?? null }
                    : null,
            };
        })
        // Newest upload first, by the date the report shows: the recorded upload time, else the file's.
        .sort((a, b) => uploadedAt(b).getTime() - uploadedAt(a).getTime() || a.url.localeCompare(b.url));
}

/** Deletes the given files (or every file) that nothing uses, checked again now; files in use or under a day old are kept. */
export async function deleteUnusedUploads(urls: string[] | "all"): Promise<{ deleted: string[]; inUse: string[]; recent: string[] }> {
    const used = await referencedUploads();
    const candidates =
        urls === "all"
            ? await filesOnDisk()
            : await Promise.all(
                  uploadFiles(urls).map(async (file) => ({ ...file, modifiedAt: (await stat(file.target).catch(() => null))?.mtime ?? null }))
              );
    const result = { deleted: [] as string[], inUse: [] as string[], recent: [] as string[] };
    for (const { url, target, modifiedAt } of candidates) {
        if (used.has(url)) {
            if (urls !== "all") result.inUse.push(url);
        } else if (modifiedAt && isRecent(modifiedAt)) {
            result.recent.push(url);
        } else {
            await removeFile(url, target);
            result.deleted.push(url);
        }
    }
    return result;
}

/** Maps upload addresses to their files on disk, dropping anything that isn't a servable upload. */
export function uploadFiles(urls: string[]): { url: string; target: string }[] {
    const files = new Map<string, string>();
    for (const url of urls) {
        const file = locate(url);
        if (file) files.set(file.url, file.target);
    }
    return [...files].map(([url, target]) => ({ url, target }));
}
