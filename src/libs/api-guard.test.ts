import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const { withApiGuard } = await import("@/libs/api-guard");

function makeRequest(ip?: string) {
    return new NextRequest("http://localhost/api/example", {
        headers: ip ? { "x-forwarded-for": ip } : undefined,
    });
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

    it("calls the handler for requests within the rate limit", async () => {
        const handler = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const guarded = withApiGuard(handler, { auth: false, rateLimit: { points: 2, duration: 60 } });

        await guarded(makeRequest("1.1.1.1"), {});
        await guarded(makeRequest("1.1.1.1"), {});

        expect(handler).toHaveBeenCalledTimes(2);
    });

    it("returns 429 without calling the handler once an IP exceeds its rate limit", async () => {
        const handler = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const guarded = withApiGuard(handler, { auth: false, rateLimit: { points: 2, duration: 60 } });

        await guarded(makeRequest("2.2.2.2"), {});
        await guarded(makeRequest("2.2.2.2"), {});
        const response = await guarded(makeRequest("2.2.2.2"), {});

        expect(response.status).toBe(429);
        expect(handler).toHaveBeenCalledTimes(2);
        const body = await response.json();
        expect(body).toEqual({ data: null, message: "Too many requests" });
    });

    it("tracks the rate limit per IP, not globally", async () => {
        const handler = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const guarded = withApiGuard(handler, { auth: false, rateLimit: { points: 1, duration: 60 } });

        const first = await guarded(makeRequest("3.3.3.1"), {});
        const second = await guarded(makeRequest("3.3.3.2"), {});

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it("returns 400 without calling the handler when an objectIdParams param is malformed", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        const handler = vi.fn();
        const guarded = withApiGuard(handler, { objectIdParams: ["id"] });

        const response = await guarded(makeRequest(), { params: Promise.resolve({ id: "not-an-id" }) });

        expect(response.status).toBe(400);
        expect(handler).not.toHaveBeenCalled();
    });

    it("calls the handler when every objectIdParams param is a valid ObjectId", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        const handler = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const guarded = withApiGuard(handler, { objectIdParams: ["id"] });

        const response = await guarded(makeRequest(), { params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }) });

        expect(response.status).toBe(200);
        expect(handler).toHaveBeenCalled();
    });

    it("still returns 401 before validating params for an unauthenticated request", async () => {
        authMock.mockResolvedValue(null);
        const guarded = withApiGuard(vi.fn(), { objectIdParams: ["id"] });

        const response = await guarded(makeRequest(), { params: Promise.resolve({ id: "not-an-id" }) });

        expect(response.status).toBe(401);
    });

    it("turns an uncaught handler error into the standard 500 response", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        vi.spyOn(console, "error").mockImplementation(() => {});
        const guarded = withApiGuard(async () => {
            throw new Error("db exploded");
        });

        const response = await guarded(makeRequest(), {});

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ data: null, message: "Something went wrong" });
    });
});
