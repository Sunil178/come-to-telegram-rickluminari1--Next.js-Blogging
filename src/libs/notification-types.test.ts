import { describe, expect, it } from "vitest";
import {
    categoryOf,
    describeNotification,
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_TYPES,
    notificationLink,
    resolvePreferences,
    type NotificationView,
} from "@/libs/notification-types";

const view = (overrides: Partial<NotificationView>): NotificationView => ({
    id: "n1", type: "post_comment", read: false, createdAt: "", actorUsername: "ana", postTitle: "Hello", postSlug: "hello", commentId: null, ...overrides,
});

describe("notification catalogue", () => {
    it("puts every type in exactly one category", () => {
        const categorized = Object.values(NOTIFICATION_CATEGORIES).flatMap((category) => category.types as readonly string[]);
        expect([...categorized].sort()).toEqual([...NOTIFICATION_TYPES].sort());
        for (const type of NOTIFICATION_TYPES) expect(categoryOf(type)).toBeDefined();
    });

    it("describes and links every type", () => {
        for (const type of NOTIFICATION_TYPES) {
            expect(describeNotification(view({ type }))).not.toBe("");
            expect(notificationLink(view({ type }))).toMatch(/^\//);
        }
        expect(notificationLink(view({ type: "comment_upvoted", commentId: "c1" }))).toBe("/posts/hello#comment-c1");
        expect(notificationLink(view({ type: "publish_request" }))).toBe("/dashboard/admin/requests");
    });

    it("treats missing preferences as enabled and keeps explicit opt-outs", () => {
        const prefs = resolvePreferences({ votes: { push: false }, replies: { inApp: false, push: false } });
        expect(prefs.votes).toEqual({ inApp: true, push: false });
        expect(prefs.replies).toEqual({ inApp: false, push: false });
        expect(prefs.comments).toEqual({ inApp: true, push: true });
        expect(resolvePreferences(undefined).requests).toEqual({ inApp: true, push: true });
    });
});
