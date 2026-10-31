import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const updateOneMock = vi.fn();
const findOneMock = vi.fn();
const findOverflowMock = vi.fn();
const deleteManyMock = vi.fn();
vi.mock("@/models/PushSubscription", () => ({
    default: {
        updateOne: (...args: unknown[]) => updateOneMock(...args),
        findOne: (...args: unknown[]) => ({ select: () => ({ lean: () => findOneMock(...args) }) }),
        find: (...args: unknown[]) => ({
            sort: (sort: unknown) => ({
                skip: (skip: unknown) => ({
                    select: () => ({ lean: () => findOverflowMock(args[0], sort, skip) }),
                }),
            }),
        }),
        deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    },
}));

const { POST } = await import("@/app/api/push/subscribe/route");

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/push/subscribe", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/push/subscribe", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "user-1", role: "reader" } });
        updateOneMock.mockReset().mockResolvedValue({});
        findOneMock.mockReset().mockResolvedValue(null);
        findOverflowMock.mockReset().mockResolvedValue([]);
        deleteManyMock.mockReset().mockResolvedValue({});
    });

    it("rejects a body missing endpoint or keys", async () => {
        const response = await POST(requestWithBody({ endpoint: "https://fcm.googleapis.com/fcm/send/1" }), {});

        expect(response.status).toBe(400);
        expect(updateOneMock).not.toHaveBeenCalled();
    });

    it("upserts by endpoint, scoped to the session user", async () => {
        const response = await POST(
            requestWithBody({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } }),
            {}
        );

        expect(response.status).toBe(200);
        expect(updateOneMock).toHaveBeenCalledWith(
            { endpoint: "https://fcm.googleapis.com/fcm/send/1" },
            { userId: "user-1", endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } },
            { upsert: true }
        );
    });

    it("rejects an endpoint that isn't a known push service, so the server never fetches arbitrary URLs", async () => {
        const response = await POST(
            requestWithBody({ endpoint: "http://169.254.169.254/latest/meta-data", keys: { p256dh: "a", auth: "b" } }),
            {}
        );

        expect(response.status).toBe(400);
        expect(updateOneMock).not.toHaveBeenCalled();
    });

    it("rejects oversized keys", async () => {
        const response = await POST(
            requestWithBody({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a".repeat(300), auth: "b" } }),
            {}
        );

        expect(response.status).toBe(400);
    });

    it("evicts the user's oldest subscriptions beyond the per-user cap", async () => {
        findOverflowMock.mockResolvedValue([{ _id: "old-1" }, { _id: "old-2" }]);

        await POST(requestWithBody({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } }), {});

        expect(findOverflowMock).toHaveBeenCalledWith({ userId: "user-1" }, { updatedAt: -1 }, 10);
        expect(deleteManyMock).toHaveBeenCalledWith({ _id: { $in: ["old-1", "old-2"] } });
    });

    it("skips the write and cap query when re-syncing an unchanged subscription", async () => {
        findOneMock.mockResolvedValue({ _id: "sub-1", userId: "user-1", keys: { p256dh: "a", auth: "b" }, updatedAt: new Date() });

        const response = await POST(requestWithBody({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } }), {});

        expect(response.status).toBe(200);
        expect(updateOneMock).not.toHaveBeenCalled();
        expect(findOverflowMock).not.toHaveBeenCalled();
    });

    it("retries once when a concurrent upsert wins the unique-index race", async () => {
        updateOneMock
            .mockRejectedValueOnce(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }))
            .mockResolvedValueOnce({});

        const response = await POST(requestWithBody({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } }), {});

        expect(response.status).toBe(200);
        expect(updateOneMock).toHaveBeenCalledTimes(2);
    });

    it("re-binds an endpoint still bound to a previous user on a shared browser", async () => {
        findOneMock.mockResolvedValue({ userId: "previous-user", keys: { p256dh: "a", auth: "b" } });

        await POST(requestWithBody({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } }), {});

        expect(updateOneMock).toHaveBeenCalledWith(
            { endpoint: "https://fcm.googleapis.com/fcm/send/1" },
            expect.objectContaining({ userId: "user-1" }),
            { upsert: true }
        );
    });

    it("refreshes a stale last-seen time on an unchanged re-sync, so active devices aren't evicted first", async () => {
        findOneMock.mockResolvedValue({
            _id: "sub-1",
            userId: "user-1",
            keys: { p256dh: "a", auth: "b" },
            updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        });

        await POST(requestWithBody({ endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } }), {});

        expect(updateOneMock).toHaveBeenCalledWith({ _id: "sub-1" }, { $set: { updatedAt: expect.any(Date) } });
        expect(findOverflowMock).not.toHaveBeenCalled();
    });
});
