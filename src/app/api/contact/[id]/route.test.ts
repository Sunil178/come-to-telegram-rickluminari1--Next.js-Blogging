import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const updateMock = vi.fn();
vi.mock("@/models/ContactMessage", () => ({
    default: { findByIdAndUpdate: (...args: unknown[]) => ({ select: () => ({ lean: async () => updateMock(...args) }) }) },
}));

const { PATCH } = await import("@/app/api/contact/[id]/route");

const ID = "6500000000000000000000c1";
const context = (id = ID) => ({ params: Promise.resolve({ id }) });
const patch = (body: unknown) => new NextRequest(`http://localhost/api/contact/${ID}`, { method: "PATCH", body: JSON.stringify(body) });

describe("PATCH /api/contact/[id]", () => {
    beforeEach(() => {
        authMock.mockReset().mockResolvedValue({ user: { id: "admin1", role: "admin" } });
        updateMock.mockReset().mockResolvedValue({ status: "resolved" });
    });

    it("marks a message resolved by the admin, and reopens it", async () => {
        expect((await PATCH(patch({ status: "resolved" }), context())).status).toBe(200);
        expect(updateMock).toHaveBeenCalledWith(ID, { $set: expect.objectContaining({ status: "resolved", resolvedBy: "admin1", resolvedAt: expect.any(Date) }) }, { new: true });
        await PATCH(patch({ status: "open" }), context());
        expect(updateMock).toHaveBeenLastCalledWith(ID, { $set: { status: "open", resolvedAt: null, resolvedBy: null } }, { new: true });
    });

    it("is for admins only", async () => {
        authMock.mockResolvedValue({ user: { id: "m1", role: "moderator" } });
        expect((await PATCH(patch({ status: "resolved" }), context())).status).toBe(403);
        expect(updateMock).not.toHaveBeenCalled();
    });

    it("refuses an unknown status and answers 404 for a missing message", async () => {
        expect((await PATCH(patch({ status: "deleted" }), context())).status).toBe(400);
        updateMock.mockResolvedValue(null);
        expect((await PATCH(patch({ status: "resolved" }), context())).status).toBe(404);
    });
});
