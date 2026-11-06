import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));
vi.mock("@/libs/upload-cleanup", async () => {
    const actual = await vi.importActual<typeof import("@/libs/upload-cleanup")>("@/libs/upload-cleanup");
    return { uploadFiles: actual.uploadFiles, listUploads: async () => [] };
});
vi.mock("@/models/Upload", () => ({ default: { distinct: async () => ["/uploads/d/private.png"] } }));

const root = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-download-"));
const { GET } = await import("@/app/api/uploads/download/route");

describe("GET /api/uploads/download", () => {
    beforeAll(() => {
        vi.stubEnv("UPLOAD_DIR", root);
        fs.mkdirSync(path.join(root, "d"));
        fs.writeFileSync(path.join(root, "d", "public.png"), "p");
        fs.writeFileSync(path.join(root, "d", "private.png"), "s");
    });
    afterAll(() => {
        fs.rmSync(root, { recursive: true, force: true });
        vi.unstubAllEnvs();
    });

    it("leaves out private posts' images, even for admins", async () => {
        authMock.mockResolvedValue({ user: { id: "a1", role: "admin" } });
        const response = await GET(new NextRequest("http://localhost/api/uploads/download?url=/uploads/d/public.png&url=/uploads/d/private.png"), {});
        expect(response.status).toBe(200);
        expect(response.headers.get("content-disposition")).toContain("public.png");

        const only = await GET(new NextRequest("http://localhost/api/uploads/download?url=/uploads/d/private.png"), {});
        expect(only.status).toBe(404);
    });
});
