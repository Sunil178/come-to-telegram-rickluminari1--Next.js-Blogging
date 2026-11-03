import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
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
const upsertNotificationMock = vi.fn();
vi.mock("@/models/Notification", () => ({
    default: {
        create: (...args: unknown[]) => createNotificationMock(...args),
        updateOne: (...args: unknown[]) => upsertNotificationMock(...args),
    },
}));

let recipient: { notificationPrefs?: Record<string, { inApp?: boolean; push?: boolean }> } | null = {};
vi.mock("@/models/User", () => ({
    default: { findById: () => ({ select: () => ({ lean: async () => recipient }) }) },
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
    actorUsername: "ana",
    postTitle: "Some post",
    postSlug: "some-post",
};

describe("notify", () => {
    beforeEach(() => {
        createNotificationMock.mockReset().mockResolvedValue({ _id: { toString: () => "notif-1" } });
        upsertNotificationMock.mockReset().mockResolvedValue({ upsertedCount: 1, upsertedId: { toString: () => "notif-9" } });
        recipient = {};
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

    // A kept-alive socket opened while handling a request holds on to that request's context (see db-connect.ts).
    it("sends without keep-alive sockets", async () => {
        findSubscriptionsMock.mockResolvedValue([
            { _id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } },
        ]);

        await notify(baseOptions);

        expect(sendNotificationMock.mock.calls[0][2].agent.keepAlive).toBe(false);
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

describe("notify preferences and deduplication", () => {
    let freshNotify: typeof notify;
    beforeEach(async () => {
        vi.resetModules();
        ({ notify: freshNotify } = await import("@/libs/notify"));
        createNotificationMock.mockReset().mockResolvedValue({ _id: { toString: () => "notif-1" } });
        upsertNotificationMock.mockReset().mockResolvedValue({ upsertedCount: 1, upsertedId: { toString: () => "notif-9" } });
        findSubscriptionsMock.mockReset().mockResolvedValue([]);
        sendNotificationMock.mockReset().mockResolvedValue({});
        recipient = {};
    });

    const subscription = { _id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/1", keys: { p256dh: "a", auth: "b" } };

    it("skips everything when the recipient turned both channels off for the category", async () => {
        recipient = { notificationPrefs: { replies: { inApp: false, push: false } } };
        await freshNotify(baseOptions);
        expect(createNotificationMock).not.toHaveBeenCalled();
        expect(findSubscriptionsMock).not.toHaveBeenCalled();
    });

    it("sends push without an in-app record when in-app is off", async () => {
        recipient = { notificationPrefs: { replies: { inApp: false } } };
        findSubscriptionsMock.mockResolvedValue([subscription]);
        await freshNotify(baseOptions);
        expect(createNotificationMock).not.toHaveBeenCalled();
        expect(JSON.parse(sendNotificationMock.mock.calls[0][1]).notificationId).toBeUndefined();
    });

    it("writes in-app but doesn't push when push is off", async () => {
        recipient = { notificationPrefs: { replies: { push: false } } };
        findSubscriptionsMock.mockResolvedValue([subscription]);
        await freshNotify(baseOptions);
        expect(createNotificationMock).toHaveBeenCalled();
        expect(sendNotificationMock).not.toHaveBeenCalled();
    });

    it("skips a recipient that no longer exists", async () => {
        recipient = null;
        await freshNotify(baseOptions);
        expect(createNotificationMock).not.toHaveBeenCalled();
    });

    it("notifies once per actor and target for deduplicated types", async () => {
        findSubscriptionsMock.mockResolvedValue([subscription]);
        await freshNotify({ ...baseOptions, type: "post_upvoted", commentId: null });
        upsertNotificationMock.mockResolvedValueOnce({ upsertedCount: 0 });
        await freshNotify({ ...baseOptions, type: "post_upvoted", commentId: null });

        expect(upsertNotificationMock).toHaveBeenCalledTimes(2);
        const [filter, update, options] = upsertNotificationMock.mock.calls[0];
        expect(filter).toEqual({ recipientId: "user-1", actorId: "user-2", type: "post_upvoted", postId: "post-1", commentId: null });
        expect(update.$setOnInsert).toMatchObject(filter);
        expect(options).toEqual({ upsert: true });
        expect(sendNotificationMock).toHaveBeenCalledTimes(1);
        expect(JSON.parse(sendNotificationMock.mock.calls[0][1]).notificationId).toBe("notif-9");
    });

    it("keeps a muted record for deduplicated types when in-app is off, so repeats stay silent", async () => {
        recipient = { notificationPrefs: { votes: { inApp: false } } };
        await freshNotify({ ...baseOptions, type: "post_upvoted", commentId: null });
        const record = upsertNotificationMock.mock.calls[0][1].$setOnInsert;
        expect(record).toMatchObject({ muted: true, read: true, dedupe: true });
        // No readAt: the read TTL must not delete the record that keeps repeats silent.
        expect(record.readAt).toBeUndefined();
    });

    it("treats a duplicate-key race on the dedupe index as already notified", async () => {
        findSubscriptionsMock.mockResolvedValue([subscription]);
        upsertNotificationMock.mockRejectedValueOnce(Object.assign(new Error("E11000"), { code: 11000 }));
        await freshNotify({ ...baseOptions, type: "post_upvoted", commentId: null });
        expect(sendNotificationMock).not.toHaveBeenCalled();
    });

    it("builds the push text and link from the shared catalogue", async () => {
        findSubscriptionsMock.mockResolvedValue([subscription]);
        await freshNotify(baseOptions);
        expect(JSON.parse(sendNotificationMock.mock.calls[0][1])).toMatchObject({
            title: "New reply",
            body: 'ana replied to your comment on "Some post"',
            url: "/posts/some-post#comment-comment-1",
        });
    });
});
