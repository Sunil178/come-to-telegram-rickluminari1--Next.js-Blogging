import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const findOneAndUpdateMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: { findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args) },
}));

const { PATCH } = await import("@/app/api/users/role/[id]/route");

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/users/u1/role", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/users/[id]/role", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
    });

    it("rejects an invalid role value", async () => {
        const response = await PATCH(requestWithBody({ role: "superuser" }), context("u1"));
        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("blocks an admin from changing their own role", async () => {
        const response = await PATCH(requestWithBody({ role: "reader" }), context("admin1"));
        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("returns 404 when the target user doesn't exist", async () => {
        findOneAndUpdateMock.mockResolvedValue(null);
        const response = await PATCH(requestWithBody({ role: "moderator" }), context("missing"));
        expect(response.status).toBe(404);
    });

    it("updates the target user's role", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "u1", role: "moderator" });
        const response = await PATCH(requestWithBody({ role: "moderator" }), context("u1"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith({ _id: "u1" }, { role: "moderator" }, { new: true });
    });
});
