import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const findOneAndUpdateMock = vi.fn();
vi.mock("@/models/PublishRequest", () => ({
    default: { findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args) },
}));

const updateOneMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/models/User", () => ({
    default: { updateOne: (...args: unknown[]) => updateOneMock(...args) },
}));

const { PATCH } = await import("@/app/api/publish-requests/[id]/route");

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/publish-requests/r1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/publish-requests/[id]", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
        updateOneMock.mockClear();
    });

    it("rejects an invalid action", async () => {
        const response = await PATCH(requestWithBody({ action: "delete" }), context("r1"));
        expect(response.status).toBe(400);
    });

    it("returns 404 when there's no matching pending request", async () => {
        findOneAndUpdateMock.mockResolvedValue(null);
        const response = await PATCH(requestWithBody({ action: "approve" }), context("r1"));
        expect(response.status).toBe(404);
    });

    it("approving sets the requester's role to author", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "r1", userId: "reader1", status: "Approved" });
        const response = await PATCH(requestWithBody({ action: "approve" }), context("r1"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { _id: "r1", status: "Pending" },
            expect.objectContaining({ status: "Approved", reviewedBy: "admin1", reviewedAt: expect.any(Date) }),
            { new: true }
        );
        expect(updateOneMock).toHaveBeenCalledWith({ _id: "reader1" }, { role: "author" });
    });

    it("rejecting doesn't change the requester's role", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "r1", userId: "reader1", status: "Rejected" });
        const response = await PATCH(requestWithBody({ action: "reject" }), context("r1"));

        expect(response.status).toBe(200);
        expect(updateOneMock).not.toHaveBeenCalled();
    });
});
