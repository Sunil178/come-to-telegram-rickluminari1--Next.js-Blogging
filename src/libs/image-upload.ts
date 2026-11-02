import path from "node:path";
import fs from "node:fs/promises";
import { v4 as uuidv4 } from "uuid";
import { IMAGE_EXTENSIONS, uploadRoot, UPLOAD_URL_PREFIX } from "@/libs/uploads";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

// `file.type` is just a client claim and can be forged — check the actual bytes.
function matchesSignature(buffer: Buffer, mimeType: string): boolean {
    switch (mimeType) {
        case "image/jpeg":
            return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        case "image/png":
            return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        case "image/gif":
            return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
        case "image/webp":
            return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
        default:
            return false;
    }
}

export type SavedImage = { ok: true; url: string } | { ok: false; message: string };

/** Validates an uploaded image (type allowlist, size, real file signature) and stores it under UPLOAD_DIR. */
export async function saveUploadedImage(file: FormDataEntryValue | null): Promise<SavedImage> {
    if (!file || typeof file === "string") return { ok: false, message: "Invalid file" };
    // Extension is derived from this allowlist, never from the client-supplied filename.
    const extension = IMAGE_EXTENSIONS[file.type];
    if (!extension) return { ok: false, message: "Unsupported file type" };
    if (file.size > MAX_FILE_SIZE_BYTES) return { ok: false, message: "File is too large (max 5MB)" };

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesSignature(buffer, file.type)) return { ok: false, message: "File content doesn't match its declared type" };

    const today = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }).split("/");
    const dateDir = `${today[2]}-${today[1]}-${today[0]}`;
    const uploadDir = path.join(uploadRoot(), dateDir);
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${uuidv4()}.${extension}`;
    await fs.writeFile(path.join(uploadDir, filename), buffer);
    return { ok: true, url: `${UPLOAD_URL_PREFIX}/${dateDir}/${filename}` };
}
