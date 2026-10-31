import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: (fn: () => unknown) => fn() };
});
const notifyMock = vi.fn();
vi.mock("@/libs/notify", () => ({ notify: (...args: unknown[]) => notifyMock(...args) }));

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const findOneAndUpdateMock = vi.fn();
vi.mock("@/models/PublishRequest", () => ({
    default: { findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args) },
}));

const updateOneMock = vi.fn().mockResolvedValue(undefined);
const userSelectMock = vi.fn();
const userFindByIdMock = vi.fn().mockReturnValue({ select: userSelectMock });
vi.mock("@/models/User", () => ({
    default: {
        updateOne: (...args: unknown[]) => updateOneMock(...args),
        findById: (...args: unknown[]) => userFindByIdMock(...args),
    },
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
        notifyMock.mockReset();
        updateOneMock.mockClear();
        userFindByIdMock.mockClear();
        userSelectMock.mockReset();
        userSelectMock.mockResolvedValue({ role: "reader" });
    });

    it("rejects an invalid action", async () => {
        const response = await PATCH(requestWithBody({ action: "delete" }), context("6500000000000000000000a1"));
        expect(response.status).toBe(400);
    });

    it("returns 404 when there's no matching pending request", async () => {
        findOneAndUpdateMock.mockResolvedValue(null);
        const response = await PATCH(requestWithBody({ action: "approve" }), context("6500000000000000000000a1"));
        expect(response.status).toBe(404);
    });

    it("approving sets the requester's role to author", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "6500000000000000000000a1", userId: "reader1", status: "Approved" });
        const response = await PATCH(requestWithBody({ action: "approve" }), context("6500000000000000000000a1"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { _id: "6500000000000000000000a1", status: "Pending" },
            expect.objectContaining({ status: "Approved", reviewedBy: "admin1", reviewedAt: expect.any(Date) }),
            { returnDocument: "after" }
        );
        expect(updateOneMock).toHaveBeenCalledWith({ _id: "reader1" }, { role: "author" });
        expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "reader1", actorId: "admin1", type: "publish_request_approved" }));
    });

    it("rejecting doesn't change the requester's role", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "6500000000000000000000a1", userId: "reader1", status: "Rejected" });
        const response = await PATCH(requestWithBody({ action: "reject" }), context("6500000000000000000000a1"));

        expect(response.status).toBe(200);
        expect(updateOneMock).not.toHaveBeenCalled();
        expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "reader1", type: "publish_request_rejected" }));
    });

    it("approving a requester already promoted (e.g. to moderator) since the request was made doesn't overwrite their role", async () => {
        userSelectMock.mockResolvedValue({ role: "moderator" });
        findOneAndUpdateMock.mockResolvedValue({ _id: "6500000000000000000000a1", userId: "reader1", status: "Approved" });
        const response = await PATCH(requestWithBody({ action: "approve" }), context("6500000000000000000000a1"));

        expect(response.status).toBe(200);
        expect(updateOneMock).not.toHaveBeenCalled();
    });
});
