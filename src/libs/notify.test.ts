import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-public-key");
vi.stubEnv("VAPID_CONTACT_EMAIL", "mailto:test@example.com");

const setVapidDetailsMock = vi.fn();
const sendNotificationMock = vi.fn();
vi.mock("web-push", () => ({
    default: {
        setVapidDetails: (...args: unknown[]) => setVapidDetailsMock(...args),
        sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
    },
}));

const createNotificationMock = vi.fn();
vi.mock("@/models/Notification", () => ({
    default: { create: (...args: unknown[]) => createNotificationMock(...args) },
}));

const findSubscriptionsMock = vi.fn();
const deleteSubscriptionMock = vi.fn();
vi.mock("@/models/PushSubscription", () => ({
    default: {
        find: (...args: unknown[]) => ({ lean: () => findSubscriptionsMock(...args) }),
        deleteOne: (...args: unknown[]) => deleteSubscriptionMock(...args),
    },
}));

const { notify } = await import("@/libs/notify");

const baseOptions = {
    recipientId: "user-1",
    actorId: "user-2",
    type: "comment_reply" as const,
    postId: "post-1",
    commentId: "comment-1",
    title: "New reply",
    body: "Someone replied to your comment",
    url: "/posts/some-post",
};

describe("notify", () => {
    beforeEach(() => {
        createNotificationMock.mockReset().mockResolvedValue({ _id: { toString: () => "notif-1" } });
        findSubscriptionsMock.mockReset().mockResolvedValue([]);
        sendNotificationMock.mockReset().mockResolvedValue({});
        deleteSubscriptionMock.mockReset().mockResolvedValue({});
    });

    it("skips writing and sending when the actor is the recipient", async () => {
        await notify({ ...baseOptions, actorId: "user-1", recipientId: "user-1" });

        expect(createNotificationMock).not.toHaveBeenCalled();
        expect(findSubscriptionsMock).not.toHaveBeenCalled();
    });

    it("writes the notification and sends a push to every subscription on file", async () => {
        findSubscriptionsMock.mockResolvedValue([
            { _id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } },
            { _id: "sub-2", endpoint: "https://fcm.googleapis.com/fcm/send/2", keys: { p256dh: "c", auth: "d" } },
        ]);

        await notify(baseOptions);

        expect(createNotificationMock).toHaveBeenCalledWith(
            expect.objectContaining({ recipientId: "user-1", actorId: "user-2", type: "comment_reply" })
        );
        expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    });

    it("includes the created notification's own id in the push payload, for the SW to mark it read on click", async () => {
        findSubscriptionsMock.mockResolvedValue([
            { _id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } },
        ]);

        await notify(baseOptions);

        const payload = JSON.parse(sendNotificationMock.mock.calls[0][1]);
        expect(payload.notificationId).toBe("notif-1");
    });

    it("deletes a subscription that reports 410 Gone, without throwing", async () => {
        findSubscriptionsMock.mockResolvedValue([
            { _id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } },
        ]);
        sendNotificationMock.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));

        await expect(notify(baseOptions)).resolves.toBeUndefined();

        expect(deleteSubscriptionMock).toHaveBeenCalledWith({ _id: "sub-1" });
    });

    it("swallows a non-410/404 send failure without throwing or deleting the subscription", async () => {
        findSubscriptionsMock.mockResolvedValue([
            { _id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } },
        ]);
        sendNotificationMock.mockRejectedValue(Object.assign(new Error("server error"), { statusCode: 500 }));

        await expect(notify(baseOptions)).resolves.toBeUndefined();

        expect(deleteSubscriptionMock).not.toHaveBeenCalled();
    });

    it("still attempts to send push even if writing the notification row fails", async () => {
        createNotificationMock.mockRejectedValue(new Error("db down"));
        findSubscriptionsMock.mockResolvedValue([
            { _id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } },
        ]);

        await expect(notify(baseOptions)).resolves.toBeUndefined();

        expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    });
});

describe("notify with unusable VAPID keys", () => {
    it("degrades to in-app only instead of throwing at import", async () => {
        vi.resetModules();
        setVapidDetailsMock.mockImplementationOnce(() => {
            throw new Error("Vapid public key should be 65 bytes long when decoded.");
        });
        createNotificationMock.mockReset().mockResolvedValue({ _id: { toString: () => "notif-1" } });
        sendNotificationMock.mockReset();

        const { notify: freshNotify } = await import("@/libs/notify");
        await expect(freshNotify(baseOptions)).resolves.toBeUndefined();

        expect(createNotificationMock).toHaveBeenCalled();
        expect(sendNotificationMock).not.toHaveBeenCalled();
    });
});

describe("notify endpoint filtering", () => {
    it("never sends to a stored endpoint outside the push-service allowlist", async () => {
        vi.resetModules();
        const { notify: freshNotify } = await import("@/libs/notify");
        createNotificationMock.mockReset().mockResolvedValue({ _id: { toString: () => "notif-1" } });
        sendNotificationMock.mockReset().mockResolvedValue({});
        findSubscriptionsMock.mockReset().mockResolvedValue([
            { _id: "sub-1", endpoint: "http://127.0.0.1:27017/", keys: { p256dh: "a", auth: "b" } },
            { _id: "sub-2", endpoint: "https://fcm.googleapis.com/fcm/send/2", keys: { p256dh: "c", auth: "d" } },
        ]);

        await freshNotify(baseOptions);

        expect(sendNotificationMock).toHaveBeenCalledTimes(1);
        expect(sendNotificationMock.mock.calls[0][0].endpoint).toBe("https://fcm.googleapis.com/fcm/send/2");
    });
});
