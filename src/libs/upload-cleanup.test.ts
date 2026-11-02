import { mkdtemp, mkdir, rm, writeFile, access, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postsMock = vi.fn();
const usersMock = vi.fn();
const revisionsMock = vi.fn();
const recordsMock = vi.fn();
const markRemovedMock = vi.fn();
const chain = (result: () => unknown) => ({ select: () => ({ lean: async () => result() }) });
vi.mock("@/models/Post", () => ({ default: { findWithDeleted: () => chain(postsMock), findOneWithDeleted: () => chain(() => null) } }));
vi.mock("@/models/User", () => ({ default: { findWithDeleted: () => chain(usersMock), findOneWithDeleted: () => chain(() => null) } }));
vi.mock("@/models/PostRevision", () => ({ default: { find: () => chain(revisionsMock), findOne: () => chain(() => null) } }));
vi.mock("@/models/Upload", () => ({
    default: {
        find: () => ({ populate: () => ({ lean: async () => recordsMock() }) }),
        updateOne: (...args: unknown[]) => markRemovedMock(...args),
    },
}));

const { deleteUnusedUploads, listUploads, uploadFiles, uploadUrlsIn } = await import("@/libs/upload-cleanup");

let root: string;
const exists = (file: string) => access(path.join(root, file)).then(() => true, () => false);

beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "uploads-"));
    vi.stubEnv("UPLOAD_DIR", root);
    await mkdir(path.join(root, "2026-11-02"));
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    for (const name of ["banner.png", "inline.jpg", "avatar.webp", "orphan.gif", "old-banner.png"]) {
        await writeFile(path.join(root, "2026-11-02", name), "x");
        await utimes(path.join(root, "2026-11-02", name), twoDaysAgo, twoDaysAgo);
    }
    // Just uploaded from the editor; the post using it may not be saved yet.
    await writeFile(path.join(root, "2026-11-02", "fresh.png"), "x");
    await writeFile(path.join(root, "notes.txt"), "not an image");
    postsMock.mockReturnValue([{ bannerImage: "/uploads/2026-11-02/banner.png", content: '[{"type":"img","url":"/uploads/2026-11-02/inline.jpg"}]' }]);
    usersMock.mockReturnValue([{ avatar: "/uploads/2026-11-02/avatar.webp" }]);
    revisionsMock.mockReturnValue([{ bannerImage: "/uploads/2026-11-02/old-banner.png", content: "" }]);
    recordsMock.mockReturnValue([{ url: "/uploads/2026-11-02/orphan.gif", purpose: "post", width: 1, height: 1, originalSize: 9, metadata: null, createdAt: new Date(), userId: { username: "alice" } }]);
    markRemovedMock.mockReset();
});
afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(root, { recursive: true, force: true });
});

describe("listUploads", () => {
    it("lists every image file with whether a post, revision or profile photo uses it, and its uploader when recorded", async () => {
        const files = await listUploads();
        expect(Object.fromEntries(files.map((file) => [file.url, [file.used, file.recent]]))).toEqual({
            "/uploads/2026-11-02/banner.png": [true, false],
            "/uploads/2026-11-02/inline.jpg": [true, false],
            "/uploads/2026-11-02/avatar.webp": [true, false],
            "/uploads/2026-11-02/old-banner.png": [true, false],
            "/uploads/2026-11-02/orphan.gif": [false, false],
            "/uploads/2026-11-02/fresh.png": [false, true],
        });
        expect(files.find((file) => file.url.endsWith("orphan.gif"))?.record?.uploader).toBe("alice");
    });
});

describe("deleteUnusedUploads", () => {
    it("deletes unused files and marks their records removed; keeps files in use and files under a day old", async () => {
        const result = await deleteUnusedUploads(["/uploads/2026-11-02/orphan.gif", "/uploads/2026-11-02/banner.png", "/uploads/2026-11-02/old-banner.png", "/uploads/2026-11-02/fresh.png", "/uploads/../../etc/passwd.png"]);
        expect(result).toEqual({ deleted: ["/uploads/2026-11-02/orphan.gif"], inUse: ["/uploads/2026-11-02/banner.png", "/uploads/2026-11-02/old-banner.png"], recent: ["/uploads/2026-11-02/fresh.png"] });
        expect(await exists("2026-11-02/orphan.gif")).toBe(false);
        expect(await exists("2026-11-02/banner.png")).toBe(true);
        expect(await exists("2026-11-02/fresh.png")).toBe(true);
        // The record stays (without the photo metadata) so the day's upload count still includes it.
        expect(markRemovedMock).toHaveBeenCalledWith({ url: "/uploads/2026-11-02/orphan.gif" }, { $set: { removedAt: expect.any(Date) }, $unset: { metadata: 1 } });
    });

    it("checks the file a URL resolves to, so a disguised URL can't remove a file in use", async () => {
        const result = await deleteUnusedUploads(["/uploads/2026-11-02//banner.png", "/uploads/2026-11-02/./inline.jpg"]);
        expect(result.deleted).toEqual([]);
        expect(await exists("2026-11-02/banner.png")).toBe(true);
        expect(await exists("2026-11-02/inline.jpg")).toBe(true);
    });

    it("deletes every unused file older than a day when asked for all", async () => {
        expect(await deleteUnusedUploads("all")).toEqual({ deleted: ["/uploads/2026-11-02/orphan.gif"], inUse: [], recent: ["/uploads/2026-11-02/fresh.png"] });
    });

    it("treats an already missing file as deleted", async () => {
        expect(await deleteUnusedUploads(["/uploads/2026-11-02/gone.png"])).toEqual({ deleted: ["/uploads/2026-11-02/gone.png"], inUse: [], recent: [] });
    });
});

describe("uploadUrlsIn", () => {
    it("finds this site's upload addresses in post content, not other sites' /uploads/ paths", () => {
        expect(uploadUrlsIn('[{"url":"/uploads/a/b.png"},{"url":"https://other.site/uploads/a/c.png"}] ![x](/uploads/a/d.JPG)')).toEqual(["/uploads/a/b.png", "/uploads/a/d.JPG"]);
    });
});

describe("uploadFiles", () => {
    it("drops traversal attempts and anything that isn't a servable image", () => {
        expect(uploadFiles(["/uploads/2026-11-02/orphan.gif", "/uploads/../secret.png", "/uploads/notes.txt", "/elsewhere/a.png"]).map((file) => file.url)).toEqual(["/uploads/2026-11-02/orphan.gif"]);
    });
});
