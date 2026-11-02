import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeFileMock = vi.fn();
vi.mock("node:fs/promises", () => ({
    default: {
        mkdir: vi.fn(async () => undefined),
        writeFile: async (...args: unknown[]) => writeFileMock(...args),
        unlink: vi.fn(async () => undefined),
    },
}));
vi.mock("uuid", () => ({ v4: () => "fixed-uuid" }));

const createMock = vi.fn();
const countMock = vi.fn();
const aggregateMock = vi.fn();
vi.mock("@/models/Upload", () => ({
    default: {
        create: (...args: unknown[]) => createMock(...args),
        countDocuments: (...args: unknown[]) => countMock(...args),
        aggregate: (...args: unknown[]) => aggregateMock(...args),
    },
}));

const { saveUploadedImage, readExif } = await import("@/libs/image-upload");

const OWNER = { userId: "64b000000000000000000001", purpose: "post" as const };
const canvas = (width = 40, height = 20) => sharp({ create: { width, height, channels: 3, background: "#c33" } });

// A phone-style photo: camera, time, GPS (Pune) and an orientation that turns it upright.
async function phonePhoto(): Promise<Buffer> {
    return canvas()
        .jpeg()
        .withMetadata({
            orientation: 6,
            exif: {
                IFD0: { Make: "Canon", Model: "EOS R5" },
                IFD2: { DateTimeOriginal: "2026:10:01 09:30:00" },
                IFD3: { GPSLatitudeRef: "N", GPSLatitude: "18/1 31/1 12/1", GPSLongitudeRef: "E", GPSLongitude: "73/1 51/1 0/1" },
            },
        })
        .toBuffer();
}

const asFile = (bytes: Buffer, name: string, type: string) => new File([new Uint8Array(bytes)], name, { type });

describe("saveUploadedImage", () => {
    beforeEach(() => {
        writeFileMock.mockReset();
        createMock.mockReset().mockResolvedValue({});
        countMock.mockReset().mockResolvedValue(0);
        aggregateMock.mockReset().mockResolvedValue([]);
    });
    afterEach(() => vi.unstubAllEnvs());

    it("serves a copy without the photo's metadata and keeps that metadata privately with the record", async () => {
        const result = await saveUploadedImage(asFile(await phonePhoto(), "../../etc/passwd.jpg", "image/jpeg"), OWNER);

        expect(result).toEqual({ ok: true, url: expect.stringMatching(/^\/uploads\/[\d-]+\/fixed-uuid\.jpg$/) });
        const written = writeFileMock.mock.calls[0][1] as Buffer;
        const served = await sharp(written).metadata();
        expect(served.exif).toBeUndefined();
        // Turned upright from the EXIF orientation before it was dropped.
        expect([served.width, served.height]).toEqual([20, 40]);

        const record = createMock.mock.calls[0][0];
        expect(record).toMatchObject({ url: (result as { url: string }).url, userId: OWNER.userId, purpose: "post", mimeType: "image/jpeg", size: written.length, width: 20, height: 40 });
        expect(record.metadata).toMatchObject({ make: "Canon", model: "EOS R5", gps: { latitude: expect.closeTo(18.52, 2), longitude: expect.closeTo(73.85, 2) } });
        expect(record.metadata.takenAt).toBeInstanceOf(Date);
    });

    it("keeps PNG lossless: every pixel of a gradient survives", async () => {
        const raw = Buffer.alloc(64 * 64 * 3);
        for (let i = 0; i < raw.length; i += 3) [raw[i], raw[i + 1], raw[i + 2]] = [(i / 3) % 64 * 4, Math.floor(i / 3 / 64) * 4, 128];
        const png = await sharp(raw, { raw: { width: 64, height: 64, channels: 3 } }).png().toBuffer();
        expect(await saveUploadedImage(asFile(png, "a.png", "image/png"), OWNER)).toMatchObject({ ok: true });
        const stored = await sharp(writeFileMock.mock.calls[0][1]).removeAlpha().raw().toBuffer();
        expect(stored.equals(raw)).toBe(true);
    });

    it("re-encodes PNG, WebP and GIF in their own format", async () => {
        for (const [type, format] of [["image/png", "png"], ["image/webp", "webp"], ["image/gif", "gif"]] as const) {
            writeFileMock.mockReset();
            const bytes = await canvas().toFormat(format).toBuffer();
            expect(await saveUploadedImage(asFile(bytes, `a.${format}`, type), OWNER)).toMatchObject({ ok: true });
            expect((await sharp(writeFileMock.mock.calls[0][1]).metadata()).format).toBe(format);
        }
    });

    it("refuses other types, forged types and files that aren't images", async () => {
        const png = await canvas().png().toBuffer();
        expect(await saveUploadedImage(asFile(Buffer.from("<svg/>"), "a.svg", "image/svg+xml"), OWNER)).toEqual({ ok: false, message: "Unsupported file type" });
        expect(await saveUploadedImage(asFile(png, "a.jpg", "image/jpeg"), OWNER)).toEqual({ ok: false, message: "File content doesn't match its declared type" });
        expect(await saveUploadedImage(asFile(Buffer.from("not an image at all"), "a.png", "image/png"), OWNER)).toEqual({ ok: false, message: "File isn't a valid image" });
        expect(await saveUploadedImage(null, OWNER)).toEqual({ ok: false, message: "Invalid file" });
        expect(writeFileMock).not.toHaveBeenCalled();
    });

    it("applies the size, daily and storage limits from the environment", async () => {
        const png = await canvas().png().toBuffer();
        vi.stubEnv("UPLOAD_MAX_FILE_MB", "0.0001");
        expect(await saveUploadedImage(asFile(png, "a.png", "image/png"), OWNER)).toEqual({ ok: false, message: "File is too large (max 0.0001MB)" });
        vi.stubEnv("UPLOAD_MAX_FILE_MB", "");

        vi.stubEnv("UPLOAD_DAILY_LIMIT", "3");
        countMock.mockResolvedValue(3);
        expect(await saveUploadedImage(asFile(png, "a.png", "image/png"), OWNER)).toMatchObject({ ok: false, message: expect.stringContaining("3 files a day") });

        countMock.mockResolvedValue(0);
        vi.stubEnv("UPLOAD_STORAGE_LIMIT_MB", "1");
        aggregateMock.mockResolvedValue([{ total: 1024 * 1024 }]);
        expect(await saveUploadedImage(asFile(png, "a.png", "image/png"), OWNER)).toMatchObject({ ok: false, message: expect.stringContaining("Storage limit reached (1 MB of images)") });
        // Files already removed don't count towards storage.
        expect(aggregateMock.mock.calls[0][0][0]).toEqual({ $match: { userId: expect.anything(), removedAt: null } });

        vi.stubEnv("UPLOAD_DAILY_LIMIT", "0");
        vi.stubEnv("UPLOAD_STORAGE_LIMIT_MB", "0");
        countMock.mockResolvedValue(10_000);
        expect(await saveUploadedImage(asFile(png, "a.png", "image/png"), OWNER)).toMatchObject({ ok: true });
        expect(writeFileMock).toHaveBeenCalledTimes(1);
    });
});

describe("readExif", () => {
    it("returns null for a missing or unreadable block", () => {
        expect(readExif(undefined)).toBeNull();
        expect(readExif(Buffer.from("garbage"))).toBeNull();
    });

    it("puts southern and western coordinates below zero", async () => {
        const bytes = await canvas()
            .jpeg()
            .withExif({ IFD3: { GPSLatitudeRef: "S", GPSLatitude: "33/1 52/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "70/1 40/1 0/1" } })
            .toBuffer();
        const { exif } = await sharp(bytes).metadata();
        expect(readExif(exif)?.gps).toMatchObject({ latitude: expect.closeTo(-33.87, 2), longitude: expect.closeTo(-70.67, 2) });
    });
});
