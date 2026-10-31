import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const deleteOneMock = vi.fn();
vi.mock("@/models/PushSubscription", () => ({
    default: { deleteOne: (...args: unknown[]) => deleteOneMock(...args) },
}));

const { POST } = await import("@/app/api/push/unsubscribe/route");

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/push/unsubscribe", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/push/unsubscribe", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "user-1", role: "reader" } });
        deleteOneMock.mockReset().mockResolvedValue({});
    });

    it("rejects a body missing endpoint", async () => {
        const response = await POST(requestWithBody({}), {});

        expect(response.status).toBe(400);
        expect(deleteOneMock).not.toHaveBeenCalled();
    });

    it("deletes scoped to endpoint and the session user, not just endpoint alone", async () => {
        const response = await POST(requestWithBody({ endpoint: "https://push.example/1" }), {});

        expect(response.status).toBe(200);
        expect(deleteOneMock).toHaveBeenCalledWith({ endpoint: "https://push.example/1", userId: "user-1" });
    });
});
