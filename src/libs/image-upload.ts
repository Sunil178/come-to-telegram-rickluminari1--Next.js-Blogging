import path from "node:path";
import fs from "node:fs/promises";
import sharp, { type FormatEnum, type Metadata } from "sharp";
import exifReader from "exif-reader";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Upload, { type UploadMetadata, type UploadPurpose } from "@/models/Upload";
import { IMAGE_EXTENSIONS, uploadRoot, UPLOAD_URL_PREFIX } from "@/libs/uploads";

const MB = 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
// Rejects decompression bombs: a tiny file that decodes to a huge canvas.
const MAX_INPUT_PIXELS = 50_000_000;

function envNumber(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return process.env[name] && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Upload limits, read at runtime from the environment; 0 turns the daily and storage limits off. */
export function uploadLimits() {
    return {
        maxFileMb: envNumber("UPLOAD_MAX_FILE_MB", 5) || 5,
        dailyCount: envNumber("UPLOAD_DAILY_LIMIT", 50),
        storageMb: envNumber("UPLOAD_STORAGE_LIMIT_MB", 500),
        perHour: envNumber("UPLOAD_RATE_LIMIT_PER_HOUR", 30) || 30,
    };
}

const SHARP_FORMATS: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

function text(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const cleaned = value.replace(/\0/g, "").trim().slice(0, 100);
    return cleaned || undefined;
}

function decimalDegrees(dms: unknown, ref: unknown, negativeRef: string): number | undefined {
    if (!Array.isArray(dms) || dms.length !== 3 || !dms.every((part) => typeof part === "number" && Number.isFinite(part))) return undefined;
    const value = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return ref === negativeRef ? -value : value;
}

/** The camera, time and place an EXIF block records, or null when there's nothing useful. */
export function readExif(exif: Buffer | undefined): UploadMetadata | null {
    if (!exif) return null;
    let parsed: ReturnType<typeof exifReader>;
    try {
        parsed = exifReader(exif);
    } catch {
        return null;
    }
    const { Image: image = {}, Photo: photo = {}, GPSInfo: gps = {} } = parsed as unknown as Record<string, Record<string, unknown> | undefined>;
    const metadata: UploadMetadata = {
        make: text(image.Make),
        model: text(image.Model),
        lens: text(photo.LensModel),
        software: text(image.Software),
    };
    const takenAt = photo.DateTimeOriginal ?? image.DateTime;
    if (takenAt instanceof Date && !Number.isNaN(takenAt.getTime())) metadata.takenAt = takenAt;
    const latitude = decimalDegrees(gps.GPSLatitude, gps.GPSLatitudeRef, "S");
    const longitude = decimalDegrees(gps.GPSLongitude, gps.GPSLongitudeRef, "W");
    if (latitude !== undefined && longitude !== undefined && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        metadata.gps = { latitude, longitude };
        if (typeof gps.GPSAltitude === "number" && Number.isFinite(gps.GPSAltitude)) metadata.gps.altitude = gps.GPSAltitude * (gps.GPSAltitudeRef === 1 ? -1 : 1);
    }
    const kept = Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined)) as UploadMetadata;
    return Object.keys(kept).length ? kept : null;
}

async function overLimit(userId: string, size: number): Promise<string | null> {
    const { dailyCount, storageMb } = uploadLimits();
    const owner = new Types.ObjectId(userId);
    if (dailyCount > 0 && (await Upload.countDocuments({ userId: owner, createdAt: { $gte: new Date(Date.now() - DAY_MS) } })) >= dailyCount) {
        return `Upload limit reached (${dailyCount} files a day). Try again tomorrow.`;
    }
    if (storageMb > 0) {
        const [usage] = await Upload.aggregate<{ total: number }>([{ $match: { userId: owner, removedAt: null } }, { $group: { _id: null, total: { $sum: "$size" } } }]);
        if ((usage?.total ?? 0) + size > storageMb * MB) return `Storage limit reached (${storageMb} MB of images). Ask the site's admins for more room.`;
    }
    return null;
}

/** The uploaded `file` field, or null when the body isn't readable multipart form data (a 400, not a 500). */
export async function formFile(request: Request): Promise<FormDataEntryValue | null> {
    const form = await request.formData().catch(() => null);
    return form?.get("file") ?? null;
}

export type SavedImage = { ok: true; url: string } | { ok: false; message: string };

/**
 * Validates an uploaded image, re-encodes it without its metadata (so GPS never reaches readers),
 * stores it under UPLOAD_DIR and records it with the original EXIF for the uploader and admins.
 */
export async function saveUploadedImage(file: FormDataEntryValue | null, owner: { userId: string; purpose: UploadPurpose }): Promise<SavedImage> {
    if (!file || typeof file === "string") return { ok: false, message: "Invalid file" };
    // Extension is derived from this allowlist, never from the client-supplied filename.
    const extension = IMAGE_EXTENSIONS[file.type];
    if (!extension) return { ok: false, message: "Unsupported file type" };
    const { maxFileMb } = uploadLimits();
    if (file.size > maxFileMb * MB) return { ok: false, message: `File is too large (max ${maxFileMb}MB)` };

    const input = Buffer.from(await file.arrayBuffer());
    let output: Buffer;
    let info: Metadata;
    try {
        // `file.type` is only a client claim; the decoded format must match it.
        const image = sharp(input, { animated: true, limitInputPixels: MAX_INPUT_PIXELS });
        info = await image.metadata();
        if (info.format !== SHARP_FORMATS[file.type]) return { ok: false, message: "File content doesn't match its declared type" };
        // Auto-orient from EXIF before it's dropped; animated images have no orientation to apply.
        const oriented = (info.pages ?? 1) > 1 ? image : image.rotate();
        // sharp drops EXIF, XMP and IPTC unless asked to keep them; the colour profile is kept.
        // Quality only for the lossy formats: for PNG it would switch on palette quantisation.
        const lossy = info.format === "jpeg" || info.format === "webp";
        output = await oriented.keepIccProfile().toFormat(info.format as keyof FormatEnum, lossy ? { quality: 90 } : {}).toBuffer();
    } catch {
        return { ok: false, message: "File isn't a valid image" };
    }

    const limit = await overLimit(owner.userId, output.length);
    if (limit) return { ok: false, message: limit };

    const today = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }).split("/");
    const dateDir = `${today[2]}-${today[1]}-${today[0]}`;
    const uploadDir = path.join(uploadRoot(), dateDir);
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${uuidv4()}.${extension}`;
    const target = path.join(uploadDir, filename);
    const url = `${UPLOAD_URL_PREFIX}/${dateDir}/${filename}`;
    await fs.writeFile(target, output);

    const rotated = (info.orientation ?? 1) >= 5;
    try {
        await Upload.create({
            url,
            userId: owner.userId,
            purpose: owner.purpose,
            mimeType: file.type,
            size: output.length,
            originalSize: input.length,
            width: rotated ? info.pageHeight ?? info.height : info.width,
            height: rotated ? info.width : info.pageHeight ?? info.height,
            metadata: readExif(info.exif),
        });
    } catch (error) {
        // An unrecorded file would dodge the limits and the uploads report.
        await fs.unlink(target).catch(() => {});
        throw error;
    }
    return { ok: true, url };
}
