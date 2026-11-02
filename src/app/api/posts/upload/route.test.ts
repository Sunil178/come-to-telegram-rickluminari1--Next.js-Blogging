import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: authMock,
}));

const saveImageMock = vi.fn();
vi.mock("@/libs/image-upload", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/libs/image-upload")>()),
    saveUploadedImage: (...args: unknown[]) => saveImageMock(...args),
}));

const { POST } = await import("@/app/api/posts/upload/route");

function requestWithFile(file: File | null) {
    const formData = new FormData();
    if (file) formData.set("file", file);
    return new NextRequest("http://localhost/api/posts/upload", { method: "POST", body: formData });
}

const file = () => new File(["image bytes"], "banner.png", { type: "image/png" });

describe("POST /api/posts/upload", () => {
    beforeEach(() => {
        saveImageMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "u1", username: "alice", role: "author" } });
    });

    it("rejects a caller below the author role minimum", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", username: "alice", role: "reader" } });
        const response = await POST(requestWithFile(file()), {});

        expect(response.status).toBe(403);
        expect(saveImageMock).not.toHaveBeenCalled();
    });

    it("rejects a request that isn't a file upload", async () => {
        const response = await POST(new NextRequest("http://localhost/api/posts/upload", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } }), {});

        expect(response.status).toBe(400);
        expect(saveImageMock).not.toHaveBeenCalled();
    });

    it("refuses an unreadable multipart body with a 400, not a server error", async () => {
        saveImageMock.mockImplementation(async (file: unknown) => (file ? { ok: true, url: "/x" } : { ok: false, message: "Invalid file" }));
        const broken = new NextRequest("http://localhost/api/posts/upload", { method: "POST", body: "--x\r\nnot a part", headers: { "Content-Type": "multipart/form-data; boundary=x" } });
        const response = await POST(broken, {});

        expect(response.status).toBe(400);
        expect(saveImageMock).toHaveBeenCalledWith(null, { userId: "u1", purpose: "post" });
    });

    it("stores the image as a post image of the caller and returns its address", async () => {
        saveImageMock.mockResolvedValue({ ok: true, url: "/uploads/2026-11-02/fixed.png" });
        const response = await POST(requestWithFile(file()), {});

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ data: "/uploads/2026-11-02/fixed.png", location: "/uploads/2026-11-02/fixed.png" });
        expect(saveImageMock).toHaveBeenCalledWith(expect.any(File), { userId: "u1", purpose: "post" });
    });

    it("passes on why an image was refused", async () => {
        saveImageMock.mockResolvedValue({ ok: false, message: "Unsupported file type" });
        const response = await POST(requestWithFile(file()), {});

        expect(response.status).toBe(400);
        expect((await response.json()).message).toBe("Unsupported file type");
    });
});
