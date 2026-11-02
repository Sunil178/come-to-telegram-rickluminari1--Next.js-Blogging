import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const deleteMock = vi.fn();
vi.mock("@/libs/upload-cleanup", () => ({
    deleteUnusedUploads: (...args: unknown[]) => deleteMock(...args),
}));

const { DELETE } = await import("@/app/api/uploads/route");

const request = (body: unknown) => new NextRequest("http://localhost/api/uploads", { method: "DELETE", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

describe("DELETE /api/uploads", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "a1", role: "admin" } });
        deleteMock.mockReset().mockResolvedValue({ deleted: [], inUse: [], recent: [] });
    });

    it("is for admins only", async () => {
        authMock.mockResolvedValue({ user: { id: "m1", role: "moderator" } });
        expect((await DELETE(request({ urls: ["/uploads/a.png"] }), {})).status).toBe(403);
        expect(deleteMock).not.toHaveBeenCalled();
    });

    it("deletes the chosen files, or every unused one", async () => {
        await DELETE(request({ urls: ["/uploads/a.png"] }), {});
        expect(deleteMock).toHaveBeenLastCalledWith(["/uploads/a.png"]);
        await DELETE(request({ all: true }), {});
        expect(deleteMock).toHaveBeenLastCalledWith("all");
    });

    it("refuses a request that names no files properly", async () => {
        for (const body of [{}, { urls: [] }, { urls: [{ $gt: "" }] }, { urls: Array(1001).fill("/uploads/a.png") }, { all: "yes" }]) {
            expect((await DELETE(request(body), {})).status).toBe(400);
        }
        expect(deleteMock).not.toHaveBeenCalled();
    });
});
