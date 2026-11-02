import { unlink } from "node:fs/promises";
import type { SoftDeleteModel } from "mongoose-delete";
import Post, { type IPost } from "@/models/Post";
import User from "@/models/User";
import { resolveUploadPath, UPLOAD_URL_PREFIX } from "@/libs/uploads";
import { escapeRegExp } from "@/libs/search-query";
import { logger } from "@/libs/logger";

const SoftPost = Post as unknown as SoftDeleteModel<IPost>;

/** Whether any post (including soft-deleted ones, which can be restored) or profile photo still uses the file. */
export async function isUploadReferenced(url: string): Promise<boolean> {
    const [post, avatar] = await Promise.all([
        SoftPost.findOneWithDeleted({ $or: [{ bannerImage: url }, { content: { $regex: escapeRegExp(url) } }] }).select("_id").lean(),
        User.exists({ avatar: url }),
    ]);
    return Boolean(post || avatar);
}

/** Deletes an uploaded file once nothing uses it any more; anything outside UPLOAD_DIR is left alone. */
export async function removeUploadIfUnused(url: string | null | undefined): Promise<void> {
    if (!url?.startsWith(`${UPLOAD_URL_PREFIX}/`) || (await isUploadReferenced(url))) return;
    const path = resolveUploadPath(url.slice(UPLOAD_URL_PREFIX.length + 1).split("/"));
    if (!path) return;
    await unlink(path).catch((error) => {
        if (error.code !== "ENOENT") logger.warn("Failed to remove an unused upload", { path, error });
    });
}
