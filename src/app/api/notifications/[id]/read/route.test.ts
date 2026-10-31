import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const updateOneMock = vi.fn();
vi.mock("@/models/Notification", () => ({
    default: { updateOne: (...args: unknown[]) => updateOneMock(...args) },
}));

const NOTIF_ID = "507f1f77bcf86cd799439011";

const { PATCH } = await import("@/app/api/notifications/[id]/read/route");

function makeRequest() {
    return new NextRequest("http://localhost/api/notifications/notif-1/read", { method: "PATCH" });
}

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/notifications/[id]/read", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "user-1", role: "reader" } });
        updateOneMock.mockReset().mockResolvedValue({});
    });

    it("returns 401 for an unauthenticated request", async () => {
        authMock.mockResolvedValue(null);
        const response = await PATCH(makeRequest(), context(NOTIF_ID));
        expect(response.status).toBe(401);
        expect(updateOneMock).not.toHaveBeenCalled();
    });

    it("marks only the given notification read, scoped to the session user", async () => {
        const response = await PATCH(makeRequest(), context(NOTIF_ID));

        expect(response.status).toBe(200);
        expect(updateOneMock).toHaveBeenCalledWith(
            { _id: NOTIF_ID, recipientId: "user-1" },
            { $set: { read: true } }
        );
    });

    it("returns 400 for a malformed id without querying", async () => {
        const response = await PATCH(makeRequest(), context("not-an-object-id"));

        expect(response.status).toBe(400);
        expect(updateOneMock).not.toHaveBeenCalled();
    });
});
