import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const updateManyMock = vi.fn();
vi.mock("@/models/Notification", () => ({
    default: { updateMany: (...args: unknown[]) => updateManyMock(...args) },
}));

const { PATCH } = await import("@/app/api/notifications/read/route");

function makeRequest() {
    return new NextRequest("http://localhost/api/notifications/read", { method: "PATCH" });
}

describe("PATCH /api/notifications/read", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "user-1", role: "reader" } });
        updateManyMock.mockReset().mockResolvedValue({});
    });

    it("returns 401 for an unauthenticated request", async () => {
        authMock.mockResolvedValue(null);
        const response = await PATCH(makeRequest(), {});
        expect(response.status).toBe(401);
        expect(updateManyMock).not.toHaveBeenCalled();
    });

    it("marks only the session user's unread notifications read, atomically", async () => {
        const response = await PATCH(makeRequest(), {});

        expect(response.status).toBe(200);
        expect(updateManyMock).toHaveBeenCalledWith(
            { recipientId: "user-1", read: false },
            { $set: { read: true } }
        );
    });
});
