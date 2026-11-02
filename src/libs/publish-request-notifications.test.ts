import { describe, expect, it, vi, beforeEach } from "vitest";

const updateManyMock = vi.fn();
vi.mock("@/models/Notification", () => ({ default: { updateMany: (...args: unknown[]) => updateManyMock(...args) } }));
const adminsMock = vi.fn();
vi.mock("@/models/User", () => ({ default: { find: (...args: unknown[]) => ({ select: () => ({ lean: () => adminsMock(...args) }) }) } }));
const warnMock = vi.fn();
vi.mock("@/libs/logger", () => ({ logger: { warn: (...args: unknown[]) => warnMock(...args) } }));

const { markRequestNotificationsRead } = await import("@/libs/publish-request-notifications");

describe("markRequestNotificationsRead", () => {
    beforeEach(() => {
        updateManyMock.mockReset();
        warnMock.mockReset();
        adminsMock.mockResolvedValue([{ _id: "admin-a" }, { _id: "admin-b" }]);
    });

    it("marks every admin's unread notification of the requester read", async () => {
        await markRequestNotificationsRead("reader1");

        expect(adminsMock).toHaveBeenCalledWith({ role: "admin" });
        expect(updateManyMock).toHaveBeenCalledWith(
            { recipientId: { $in: ["admin-a", "admin-b"] }, read: false, type: "publish_request", actorId: "reader1" },
            { $set: { read: true, readAt: expect.any(Date) } }
        );
    });

    it("logs instead of failing the review when the update fails", async () => {
        updateManyMock.mockRejectedValue(new Error("timeout"));

        await expect(markRequestNotificationsRead("reader1")).resolves.toBeUndefined();
        expect(warnMock).toHaveBeenCalled();
    });
});
