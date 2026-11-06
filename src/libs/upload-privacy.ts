import Post from "@/models/Post";
import Upload, { type UploadAccess } from "@/models/Upload";
import User from "@/models/User";
import { ROLES } from "@/libs/roles";
import { UPLOAD_URL_PREFIX } from "@/libs/uploads";
import { uploadUrlsIn } from "@/libs/upload-cleanup";
import { escapeRegExp } from "@/libs/search-query";
import { logger } from "@/libs/logger";

/** The upload addresses a post refers to: its banner and the images in its body. */
export function postUploadUrls(post: { bannerImage?: string | null; content?: string | null }): string[] {
    return [post.bannerImage ?? "", ...uploadUrlsIn(post.content)].filter((url) => url.startsWith(`${UPLOAD_URL_PREFIX}/`));
}

// "draft" until saved in a post (no shared caching), "public" while a shared post by its uploader (or an
// admin's upload) uses it, "private" while only the uploader's private posts do; else unchanged. Never throws.
export async function syncUploadPrivacy(urls: Iterable<string>): Promise<void> {
    try {
        const list = [...new Set(urls)].filter((url) => url.startsWith(`${UPLOAD_URL_PREFIX}/`));
        if (list.length === 0) return;
        const records = await Upload.find({ url: { $in: list }, purpose: "post" }).select("url userId access").lean<{ _id: unknown; url: string; userId: { toString(): string }; access?: UploadAccess }[]>();
        if (records.length === 0) return;

        // One pass over every post (shared or private) that uses any of these files.
        const posts = await Post.find({ $or: [{ bannerImage: { $in: list } }, { content: { $regex: list.map(escapeRegExp).join("|") } }] })
            .select("userId visibility bannerImage content")
            .lean<{ userId: { toString(): string }; visibility: boolean; bannerImage?: string; content?: string }[]>();
        const admins = new Set(
            (await User.find({ _id: { $in: records.map((record) => record.userId) }, role: ROLES.ADMIN }).select("_id").lean<{ _id: { toString(): string } }[]>()).map((user) => user._id.toString())
        );

        const operations = records.flatMap((record) => {
            const uploader = record.userId.toString();
            const users = posts.filter((post) => postUploadUrls(post).includes(record.url));
            const shared = users.some((post) => post.visibility && (post.userId.toString() === uploader || admins.has(uploader)));
            const ownPrivate = users.some((post) => !post.visibility && post.userId.toString() === uploader);
            const access: UploadAccess | null = shared ? "public" : ownPrivate ? "private" : null;
            return access && access !== record.access ? [{ updateOne: { filter: { _id: record._id }, update: { $set: { access } } } }] : [];
        });
        if (operations.length > 0) await Upload.bulkWrite(operations);
    } catch (error) {
        logger.error("Failed to update image privacy", { error });
    }
}
