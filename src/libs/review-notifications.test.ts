import { describe, expect, it, vi, beforeEach } from "vitest";

const updateManyMock = vi.fn();
vi.mock("@/models/Notification", () => ({ default: { updateMany: (...args: unknown[]) => updateManyMock(...args) } }));
const staffMock = vi.fn();
vi.mock("@/models/User", () => ({ default: { find: (...args: unknown[]) => ({ select: () => ({ lean: () => staffMock(...args) }) }) } }));
const postStatusMock = vi.fn();
vi.mock("@/models/Post", () => ({ default: { findById: () => ({ select: () => ({ lean: () => postStatusMock() }) }) } }));
const notifyMock = vi.fn();
vi.mock("@/libs/notify", () => ({ notify: (...args: unknown[]) => notifyMock(...args) }));
const warnMock = vi.fn();
const errorMock = vi.fn();
vi.mock("@/libs/logger", () => ({ logger: { warn: (...args: unknown[]) => warnMock(...args), error: (...args: unknown[]) => errorMock(...args) } }));

const { markRequestNotificationsRead, markPostReviewNotificationsRead, notifyPostSubmitted } = await import("@/libs/review-notifications");

describe("review notifications", () => {
    beforeEach(() => {
        updateManyMock.mockReset();
        notifyMock.mockReset();
        warnMock.mockReset();
        staffMock.mockResolvedValue([{ _id: "staff-a" }, { _id: "staff-b" }]);
        postStatusMock.mockResolvedValue({ approval: "Pending" });
    });

    it("marks every admin's unread notification of a publish request read", async () => {
        await markRequestNotificationsRead("reader1");

        expect(staffMock).toHaveBeenCalledWith({ role: { $in: ["admin"] } });
        expect(updateManyMock).toHaveBeenCalledWith(
            { recipientId: { $in: ["staff-a", "staff-b"] }, read: false, type: "publish_request", actorId: "reader1" },
            { $set: { read: true, readAt: expect.any(Date) } }
        );
    });

    it("marks every moderator's and admin's unread notification of a reviewed post read", async () => {
        await markPostReviewNotificationsRead("post1");

        expect(staffMock).toHaveBeenCalledWith({ role: { $in: ["moderator", "admin"] } });
        expect(updateManyMock).toHaveBeenCalledWith(
            { recipientId: { $in: ["staff-a", "staff-b"] }, read: false, type: "post_submitted", postId: "post1" },
            { $set: { read: true, readAt: expect.any(Date) } }
        );
    });

    it("logs instead of failing the review when the update fails", async () => {
        updateManyMock.mockRejectedValue(new Error("timeout"));

        await expect(markRequestNotificationsRead("reader1")).resolves.toBeUndefined();
        expect(warnMock).toHaveBeenCalled();
    });

    it("tells every moderator and admin about a submitted post", async () => {
        await notifyPostSubmitted({ id: "post1", title: "Hello", slug: "hello" }, { id: "author1", username: "writer" });

        expect(notifyMock).toHaveBeenCalledTimes(2);
        expect(notifyMock).toHaveBeenCalledWith({
            recipientId: "staff-b", actorId: "author1", actorUsername: "writer", type: "post_submitted", postId: "post1", postTitle: "Hello", postSlug: "hello",
        });
    });

    it("leaves the new notifications unread while the post still waits", async () => {
        await notifyPostSubmitted({ id: "post1", title: "Hello", slug: "hello" }, { id: "author1", username: "writer" });
        expect(updateManyMock).not.toHaveBeenCalled();
    });

    it("marks them read at once when the post was reviewed or deleted before they were written", async () => {
        postStatusMock.mockResolvedValue({ approval: "Approved" });
        await notifyPostSubmitted({ id: "post1", title: "Hello", slug: "hello" }, { id: "author1", username: "writer" });
        postStatusMock.mockResolvedValue(null);
        await notifyPostSubmitted({ id: "post2", title: "Gone", slug: "gone" }, { id: "author1", username: "writer" });

        expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({ type: "post_submitted", postId: "post1" }), expect.anything());
        expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({ type: "post_submitted", postId: "post2" }), expect.anything());
    });
});
