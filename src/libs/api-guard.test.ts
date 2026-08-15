import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const { withApiGuard } = await import("@/libs/api-guard");

function makeRequest() {
    return new NextRequest("http://localhost/api/example");
}

describe("withApiGuard", () => {
    beforeEach(() => {
        authMock.mockReset();
    });

    it("returns 401 without calling the handler when there is no session", async () => {
        authMock.mockResolvedValue(null);
        const handler = vi.fn();
        const guarded = withApiGuard(handler);

        const response = await guarded(makeRequest(), {});

        expect(response.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
        const body = await response.json();
        expect(body).toEqual({ data: null, message: "Unauthorized" });
    });

    it("returns 401 when the session has no user id", async () => {
        authMock.mockResolvedValue({ user: {} });
        const handler = vi.fn();
        const guarded = withApiGuard(handler);

        const response = await guarded(makeRequest(), {});

        expect(response.status).toBe(401);
        expect(handler).not.toHaveBeenCalled();
    });

    it("passes the session through to the handler when authenticated", async () => {
        const session = { user: { id: "u1", username: "alice" } };
        authMock.mockResolvedValue(session);
        const handler = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const guarded = withApiGuard(handler);

        await guarded(makeRequest(), { extra: "context" });

        expect(handler).toHaveBeenCalledWith(expect.anything(), { extra: "context", session });
    });

    it("skips the session check entirely for auth: false routes", async () => {
        const handler = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const guarded = withApiGuard(handler, { auth: false });

        await guarded(makeRequest(), {});

        expect(authMock).not.toHaveBeenCalled();
        expect(handler).toHaveBeenCalled();
    });

    it("returns 403 when the session role is below the required minimum", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        const handler = vi.fn();
        const guarded = withApiGuard(handler, { role: "moderator" });

        const response = await guarded(makeRequest(), {});

        expect(response.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
        const body = await response.json();
        expect(body).toEqual({ data: null, message: "Forbidden" });
    });

    it("calls the handler when the session role meets the required minimum", async () => {
        const session = { user: { id: "u1", role: "admin" } };
        authMock.mockResolvedValue(session);
        const handler = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const guarded = withApiGuard(handler, { role: "moderator" });

        await guarded(makeRequest(), {});

        expect(handler).toHaveBeenCalledWith(expect.anything(), { session });
    });
});
