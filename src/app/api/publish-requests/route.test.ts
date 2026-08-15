import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOneMock = vi.fn();
const createMock = vi.fn();
vi.mock("@/models/PublishRequest", () => ({
    default: {
        findOne: (...args: unknown[]) => findOneMock(...args),
        create: (...args: unknown[]) => createMock(...args),
    },
}));

const { POST } = await import("@/app/api/publish-requests/route");

function request() {
    return new NextRequest("http://localhost/api/publish-requests", { method: "POST" });
}

describe("POST /api/publish-requests", () => {
    beforeEach(() => {
        findOneMock.mockReset();
        createMock.mockReset();
    });

    it("rejects a caller who isn't a Reader", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "author" } });

        const response = await POST(request(), {});

        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("rejects a Reader who already has a pending request", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        findOneMock.mockResolvedValue({ _id: "existing" });

        const response = await POST(request(), {});

        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("creates a request for a Reader with no pending request", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        findOneMock.mockResolvedValue(null);
        createMock.mockResolvedValue({ _id: "new1" });

        const response = await POST(request(), {});

        expect(response.status).toBe(200);
        expect(createMock).toHaveBeenCalledWith({ userId: "u1" });
    });
});
