import fs from "fs";
import os from "os";
import path from "path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: () => authMock() }));
// The file named PRIVATE_UUID is a private post's image of user "owner-1"; DRAFT_UUID is in no saved post yet.
const PRIVATE_UUID = "1f8fad5b-d9cb-469f-a165-70867728950e";
const DRAFT_UUID = "2f8fad5b-d9cb-469f-a165-70867728950e";
vi.mock("@/models/Upload", () => ({
    default: {
        findOne: (filter: { url: string }) => ({
            select: () => ({
                lean: async () =>
                    filter.url.includes(PRIVATE_UUID) ? { userId: "owner-1", access: "private" } : filter.url.includes(DRAFT_UUID) ? { userId: "owner-1", access: "draft" } : null,
            }),
        }),
    },
}));

const root = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-test-"));
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const outside = path.join(path.dirname(root), "outside-secret.png");

const { GET } = await import("@/app/uploads/[...path]/route");

function get(segments: string[]) {
    return GET(new NextRequest(`http://localhost/uploads/${segments.join("/")}`), { params: Promise.resolve({ path: segments }) });
}

describe("GET /uploads/[...path]", () => {
    beforeAll(() => {
        vi.stubEnv("UPLOAD_DIR", root);
        fs.mkdirSync(path.join(root, "2026-10-31"));
        fs.writeFileSync(path.join(root, "2026-10-31", `${UUID}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        fs.writeFileSync(path.join(root, "2026-10-31", `${PRIVATE_UUID}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        fs.writeFileSync(path.join(root, "2026-10-31", `${DRAFT_UUID}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        fs.mkdirSync(path.join(root, "seed"));
        fs.writeFileSync(path.join(root, "seed", "hello-world.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
        fs.mkdirSync(path.join(root, "folder.png"));
        fs.writeFileSync(path.join(root, "notes.html"), "<script>alert(1)</script>");
        fs.writeFileSync(outside, "secret");
    });
    afterAll(() => {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(outside, { force: true });
        vi.unstubAllEnvs();
    });

    it("serves an uploaded image with its content type and immutable caching", async () => {
        const response = await get(["2026-10-31", `${UUID}.png`]);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/png");
        expect(response.headers.get("content-length")).toBe("4");
        expect(response.headers.get("cache-control")).toContain("immutable");
        expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });

    it("caches files that can be rewritten in place (seed banners) only briefly", async () => {
        const response = await get(["seed", "hello-world.jpg"]);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/jpeg");
        expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    });

    it("serves a private post's image only to its uploader, never cached by shared caches", async () => {
        authMock.mockResolvedValue(null);
        expect((await get(["2026-10-31", `${PRIVATE_UUID}.png`])).status).toBe(404);

        authMock.mockResolvedValue({ user: { id: "someone-else", role: "admin" } });
        expect((await get(["2026-10-31", `${PRIVATE_UUID}.png`])).status).toBe(404);

        authMock.mockResolvedValue({ user: { id: "owner-1", role: "author" } });
        const response = await get(["2026-10-31", `${PRIVATE_UUID}.png`]);
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
    });

    it("serves a draft's image by its address but keeps it out of shared caches", async () => {
        authMock.mockResolvedValue(null);
        const response = await get(["2026-10-31", `${DRAFT_UUID}.png`]);
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    });

    it("returns 404 for a directory with an image-like name", async () => {
        expect((await get(["folder.png"])).status).toBe(404);
    });

    it("refuses path traversal out of the upload root", async () => {
        expect((await get(["..", "outside-secret.png"])).status).toBe(404);
        expect((await get(["2026-10-31", "..", "..", "outside-secret.png"])).status).toBe(404);
    });

    it("refuses file types that aren't images", async () => {
        expect((await get(["notes.html"])).status).toBe(404);
    });

    it("returns 404 for a missing file", async () => {
        expect((await get(["2026-10-31", "missing.png"])).status).toBe(404);
    });
});
