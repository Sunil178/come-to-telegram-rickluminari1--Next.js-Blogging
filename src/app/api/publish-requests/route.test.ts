import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: (fn: () => unknown) => fn() };
});
const notifyMock = vi.fn();
vi.mock("@/libs/notify", () => ({ notify: (...args: unknown[]) => notifyMock(...args) }));

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOneMock = vi.fn();
const createMock = vi.fn();
const requestStatusMock = vi.fn().mockResolvedValue({ status: "Pending" });
vi.mock("@/models/PublishRequest", () => ({
    default: {
        findOne: (...args: unknown[]) => findOneMock(...args),
        create: (...args: unknown[]) => createMock(...args),
        findById: () => ({ select: () => ({ lean: () => requestStatusMock() }) }),
    },
}));
const markReadMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/libs/publish-request-notifications", () => ({ markRequestNotificationsRead: (...args: unknown[]) => markReadMock(...args) }));

const userSelectMock = vi.fn();
const userFindByIdMock = vi.fn().mockReturnValue({ select: userSelectMock });
const userFindMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: {
        findById: (...args: unknown[]) => userFindByIdMock(...args),
        find: (...args: unknown[]) => ({ select: () => ({ lean: () => userFindMock(...args) }) }),
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
        userFindByIdMock.mockClear();
        userSelectMock.mockReset();
    });

    it("rejects a caller who isn't a Reader", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "author" } });
        userSelectMock.mockResolvedValue({ role: "author" });

        const response = await POST(request(), {});

        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("rejects a Reader who already has a pending request", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        userSelectMock.mockResolvedValue({ role: "reader" });
        findOneMock.mockResolvedValue({ _id: "existing" });

        const response = await POST(request(), {});

        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("creates a request for a Reader with no pending request", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        userSelectMock.mockResolvedValue({ role: "reader" });
        findOneMock.mockResolvedValue(null);
        createMock.mockResolvedValue({ _id: "new1" });

        const response = await POST(request(), {});

        expect(response.status).toBe(200);
        expect(createMock).toHaveBeenCalledWith({ userId: "u1" });
    });

    it("answers a concurrent duplicate (unique index violation) as an existing pending request", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        userSelectMock.mockResolvedValue({ role: "reader" });
        findOneMock.mockResolvedValue(null);
        createMock.mockRejectedValue(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));

        const response = await POST(request(), {});

        expect(response.status).toBe(400);
        expect((await response.json()).message).toBe("You already have a pending request");
    });

    it("allows a session with no role field (stale JWT) to submit a request, reading the current DB role", async () => {
        authMock.mockResolvedValue({ user: { id: "u1" } });
        userSelectMock.mockResolvedValue({ role: undefined });
        findOneMock.mockResolvedValue(null);
        createMock.mockResolvedValue({ _id: "new1" });

        const response = await POST(request(), {});

        expect(response.status).toBe(200);
        expect(createMock).toHaveBeenCalledWith({ userId: "u1" });
    });
});

describe("POST /api/publish-requests notifications", () => {
    it("notifies every admin of the new request", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader", username: "reader.one" } });
        userSelectMock.mockResolvedValue({ role: "reader" });
        findOneMock.mockResolvedValue(null);
        createMock.mockResolvedValue({ _id: "new1" });
        userFindMock.mockResolvedValue([{ _id: "admin-a" }, { _id: "admin-b" }]);
        notifyMock.mockReset();

        await POST(request(), {});

        expect(userFindMock).toHaveBeenCalledWith({ role: "admin" });
        expect(notifyMock).toHaveBeenCalledTimes(2);
        expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "admin-b", actorId: "u1", type: "publish_request" }));
    });

    it("marks the new notifications read when an admin reviewed the request before they were written", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader", username: "reader.one" } });
        userSelectMock.mockResolvedValue({ role: "reader" });
        findOneMock.mockResolvedValue(null);
        createMock.mockResolvedValue({ _id: "new1" });
        userFindMock.mockResolvedValue([{ _id: "admin-a" }]);
        requestStatusMock.mockResolvedValueOnce({ status: "Approved" });
        markReadMock.mockClear();

        await POST(request(), {});

        // after() work isn't awaited by the response.
        await vi.waitFor(() => expect(markReadMock).toHaveBeenCalledWith("u1"));
    });

    it("leaves the notifications unread while the request is still pending", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader", username: "reader.one" } });
        userSelectMock.mockResolvedValue({ role: "reader" });
        findOneMock.mockResolvedValue(null);
        createMock.mockResolvedValue({ _id: "new1" });
        userFindMock.mockResolvedValue([{ _id: "admin-a" }]);
        markReadMock.mockClear();

        await POST(request(), {});
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(markReadMock).not.toHaveBeenCalled();
    });
});
