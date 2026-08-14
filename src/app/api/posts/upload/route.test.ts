import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "u1", username: "alice" } }),
}));

const existsSyncMock = vi.fn().mockReturnValue(true);
const mkdirSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();
vi.mock("fs", () => ({
    default: {
        existsSync: (...args: unknown[]) => existsSyncMock(...args),
        mkdirSync: (...args: unknown[]) => mkdirSyncMock(...args),
        writeFileSync: (...args: unknown[]) => writeFileSyncMock(...args),
    },
}));

vi.mock("uuid", () => ({ v4: () => "fixed-uuid" }));

const { POST } = await import("@/app/api/posts/upload/route");

function requestWithFile(file: File | null) {
    const formData = new FormData();
    if (file) formData.set("file", file);
    return new NextRequest("http://localhost/api/posts/upload", { method: "POST", body: formData });
}

describe("POST /api/posts/upload", () => {
    beforeEach(() => {
        existsSyncMock.mockClear();
        mkdirSyncMock.mockClear();
        writeFileSyncMock.mockClear();
    });

    it("rejects a file type outside the image allowlist", async () => {
        const file = new File(["not an image"], "payload.svg", { type: "image/svg+xml" });
        const response = await POST(requestWithFile(file), {});

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toBe("Unsupported file type");
        expect(writeFileSyncMock).not.toHaveBeenCalled();
    });

    it("rejects a file over the 5MB size cap", async () => {
        const oversized = new Uint8Array(5 * 1024 * 1024 + 1);
        const file = new File([oversized], "big.png", { type: "image/png" });
        const response = await POST(requestWithFile(file), {});

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toBe("File is too large (max 5MB)");
        expect(writeFileSyncMock).not.toHaveBeenCalled();
    });

    it("rejects a request with no file", async () => {
        const response = await POST(requestWithFile(null), {});

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.message).toBe("Invalid file");
    });

    it("derives the stored filename/extension from the allowlist, never from the client-supplied name", async () => {
        const file = new File(["image bytes"], "../../etc/passwd.png", { type: "image/png" });
        const response = await POST(requestWithFile(file), {});

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.location).toMatch(/fixed-uuid\.png$/);
        expect(body.location).not.toContain("passwd");
        expect(body.location).not.toContain("..");
        expect(writeFileSyncMock).toHaveBeenCalledTimes(1);
    });
});
