import { beforeEach, describe, expect, it, vi } from "vitest";

const findMock = vi.fn();
const countDocumentsMock = vi.fn();
vi.mock("@/models/Notification", () => ({
    default: {
        find: (...args: unknown[]) => (findMock(...args), {
            sort: () => ({ skip: () => ({ limit: () => ({ populate: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) }) }) }) }),
        }),
        countDocuments: (...args: unknown[]) => countDocumentsMock(...args),
    },
}));
vi.mock("@/models/User", () => ({ default: {} }));
vi.mock("@/models/Post", () => ({ default: {} }));

const { listNotifications } = await import("@/libs/notification-feed");

describe("listNotifications", () => {
    beforeEach(() => {
        findMock.mockReset();
        countDocumentsMock.mockReset().mockResolvedValue(0);
    });

    it("lists read and unread notifications by default, for the notifications page's history", async () => {
        await listNotifications("user-1");
        expect(findMock).toHaveBeenCalledWith({ recipientId: "user-1", muted: { $ne: true } });
    });

    it("lists unread notifications only when asked, and counts unread either way", async () => {
        await listNotifications("user-1", { unreadOnly: true });
        expect(findMock).toHaveBeenCalledWith({ recipientId: "user-1", muted: { $ne: true }, read: false });
        expect(countDocumentsMock).toHaveBeenCalledWith({ recipientId: "user-1", muted: { $ne: true }, read: false });
    });
});
