import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const indexesMock = vi.fn();
const createIndexMock = vi.fn();
const dropIndexMock = vi.fn();
const updateManyMock = vi.fn();
const commandMock = vi.fn();
vi.mock("@/models/Notification", () => ({
    default: {
        collection: {
            collectionName: "notifications",
            indexes: () => indexesMock(),
            createIndex: (...args: unknown[]) => createIndexMock(...args),
            dropIndex: (...args: unknown[]) => dropIndexMock(...args),
        },
        updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
}));
vi.mock("mongoose", () => ({ default: { connection: { db: { command: (...args: unknown[]) => commandMock(...args) } } } }));

const { readTtlDays, syncNotificationReadTtl } = await import("@/libs/notification-ttl");

const DAY = 86400;

describe("read-notification TTL", () => {
    beforeEach(() => {
        for (const mock of [indexesMock, createIndexMock, dropIndexMock, updateManyMock, commandMock]) mock.mockReset().mockResolvedValue(undefined);
        indexesMock.mockResolvedValue([{ name: "_id_" }]);
    });
    afterEach(() => vi.unstubAllEnvs());

    it("reads the env, defaulting to 90 days and falling back on invalid values", () => {
        expect(readTtlDays()).toBe(90);
        vi.stubEnv("NOTIFICATION_READ_TTL_DAYS", "30");
        expect(readTtlDays()).toBe(30);
        vi.stubEnv("NOTIFICATION_READ_TTL_DAYS", "0");
        expect(readTtlDays()).toBe(0);
        vi.stubEnv("NOTIFICATION_READ_TTL_DAYS", "-5");
        expect(readTtlDays()).toBe(90);
        vi.stubEnv("NOTIFICATION_READ_TTL_DAYS", "forever");
        expect(readTtlDays()).toBe(90);
        vi.stubEnv("NOTIFICATION_READ_TTL_DAYS", "1000000");
        expect(readTtlDays()).toBe(24855);
        // Would round to 0 seconds and delete notifications as soon as they're read.
        vi.stubEnv("NOTIFICATION_READ_TTL_DAYS", "0.000001");
        expect(readTtlDays()).toBe(90);
        vi.stubEnv("NOTIFICATION_READ_TTL_DAYS", "0.5");
        expect(readTtlDays()).toBe(0.5);
    });

    it("creates the TTL index, then backfills readAt once on rows read before it existed (never on dedupe records)", async () => {
        await syncNotificationReadTtl(90);
        expect(createIndexMock).toHaveBeenCalledWith({ readAt: 1 }, { name: "readAt_ttl", expireAfterSeconds: 90 * DAY });
        expect(updateManyMock).toHaveBeenCalledWith({ read: true, readAt: null, dedupe: { $ne: true } }, { $set: { readAt: expect.any(Date) } });
        expect(createIndexMock.mock.invocationCallOrder[0]).toBeLessThan(updateManyMock.mock.invocationCallOrder[0]);
    });

    it("treats a missing collection as having no index, but doesn't swallow other errors", async () => {
        indexesMock.mockRejectedValueOnce(Object.assign(new Error("ns not found"), { code: 26 }));
        await syncNotificationReadTtl(90);
        expect(createIndexMock).toHaveBeenCalled();

        createIndexMock.mockClear();
        indexesMock.mockRejectedValueOnce(Object.assign(new Error("not authorized"), { code: 13 }));
        await syncNotificationReadTtl(90);
        expect(createIndexMock).not.toHaveBeenCalled();
    });

    it("changes an existing index's expiry in place with collMod", async () => {
        indexesMock.mockResolvedValue([{ name: "readAt_ttl", expireAfterSeconds: 90 * DAY }]);
        await syncNotificationReadTtl(365);
        expect(createIndexMock).not.toHaveBeenCalled();
        expect(updateManyMock).not.toHaveBeenCalled();
        expect(commandMock).toHaveBeenCalledWith({ collMod: "notifications", index: { name: "readAt_ttl", expireAfterSeconds: 365 * DAY } });
    });

    it("leaves a matching index alone", async () => {
        indexesMock.mockResolvedValue([{ name: "readAt_ttl", expireAfterSeconds: 30 * DAY }]);
        await syncNotificationReadTtl(30);
        expect(createIndexMock).not.toHaveBeenCalled();
        expect(commandMock).not.toHaveBeenCalled();
    });

    it("drops the index when disabled, keeping read notifications forever", async () => {
        indexesMock.mockResolvedValue([{ name: "readAt_ttl", expireAfterSeconds: 30 * DAY }]);
        await syncNotificationReadTtl(0);
        expect(dropIndexMock).toHaveBeenCalledWith("readAt_ttl");
        expect(updateManyMock).not.toHaveBeenCalled();
    });

    it("never throws at boot", async () => {
        createIndexMock.mockRejectedValue(new Error("not primary"));
        await expect(syncNotificationReadTtl(90)).resolves.toBeUndefined();
    });
});
