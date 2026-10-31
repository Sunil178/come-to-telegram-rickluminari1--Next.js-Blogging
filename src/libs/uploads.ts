import path from "path";

// Where uploaded files live on disk (persistent volume in containers) and the URL prefix they're served under.
export const UPLOAD_URL_PREFIX = "/uploads";

export function uploadRoot(): string {
    return path.resolve(process.env.UPLOAD_DIR || "uploads");
}

// The one image allowlist: MIME type → stored extension (uploads, seed banners, serving).
export const IMAGE_EXTENSIONS: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

export const UPLOAD_CONTENT_TYPES: Record<string, string> = {
    ".jpeg": "image/jpeg",
    ...Object.fromEntries(Object.entries(IMAGE_EXTENSIONS).map(([type, ext]) => [`.${ext}`, type])),
};

// Maps URL segments to a file inside the upload root, or null for traversal attempts and unservable types.
export function resolveUploadPath(segments: string[]): string | null {
    const root = uploadRoot();
    const target = path.resolve(root, ...segments);
    if (!target.startsWith(root + path.sep)) return null;
    if (!UPLOAD_CONTENT_TYPES[path.extname(target).toLowerCase()]) return null;
    return target;
}
