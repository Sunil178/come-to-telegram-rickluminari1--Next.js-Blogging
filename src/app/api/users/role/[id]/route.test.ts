import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const findOneAndUpdateMock = vi.fn();
const selectMock = vi.fn();
const findByIdMock = vi.fn().mockReturnValue({ select: selectMock });
const countDocumentsMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: {
        findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args),
        findById: (...args: unknown[]) => findByIdMock(...args),
        countDocuments: (...args: unknown[]) => countDocumentsMock(...args),
    },
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
        findByIdMock.mockClear();
        selectMock.mockReset();
        selectMock.mockResolvedValue({ role: "reader" });
        countDocumentsMock.mockReset();
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

    it("blocks demoting the last remaining admin", async () => {
        selectMock.mockResolvedValue({ role: "admin" });
        countDocumentsMock.mockResolvedValue(1);

        const response = await PATCH(requestWithBody({ role: "moderator" }), context("u1"));

        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("allows demoting an admin when other admins remain", async () => {
        selectMock.mockResolvedValue({ role: "admin" });
        countDocumentsMock.mockResolvedValue(2);
        findOneAndUpdateMock.mockResolvedValue({ _id: "u1", role: "moderator" });

        const response = await PATCH(requestWithBody({ role: "moderator" }), context("u1"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith({ _id: "u1" }, { role: "moderator" }, { new: true });
    });
});
