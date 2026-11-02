// The notification catalogue, shared by the server (notify, preferences) and the client (bell, page).

export const NOTIFICATION_TYPES = [
    "comment_reply",
    "post_comment",
    "post_upvoted",
    "comment_upvoted",
    "post_approved",
    "post_rejected",
    "post_submitted",
    "publish_request",
    "publish_request_approved",
    "publish_request_rejected",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Preferences are per category, so related types (approved/rejected) share one switch.
export const NOTIFICATION_CATEGORIES = {
    replies: { label: "Replies to your comments", types: ["comment_reply"] },
    comments: { label: "Comments on your posts", types: ["post_comment"] },
    votes: { label: "Upvotes on your posts and comments", types: ["post_upvoted", "comment_upvoted"] },
    moderation: { label: "Moderation decisions on your posts", types: ["post_approved", "post_rejected"] },
    publishing: { label: "Answers to your request to publish", types: ["publish_request_approved", "publish_request_rejected"] },
    requests: { label: "New requests to publish (admins)", types: ["publish_request"] },
    reviews: { label: "Posts waiting for review (moderators)", types: ["post_submitted"] },
} as const satisfies Record<string, { label: string; types: readonly NotificationType[] }>;
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES;
export const NOTIFICATION_CATEGORY_KEYS = Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[];

export function categoryOf(type: NotificationType): NotificationCategory {
    return NOTIFICATION_CATEGORY_KEYS.find((key) => (NOTIFICATION_CATEGORIES[key].types as readonly string[]).includes(type))!;
}

export interface ChannelPreference {
    inApp: boolean;
    push: boolean;
}
export type NotificationPreferences = Record<NotificationCategory, ChannelPreference>;

// Missing entries mean "on", so accounts that never opened the settings get everything.
export function resolvePreferences(stored?: Partial<Record<string, Partial<ChannelPreference>>> | null): NotificationPreferences {
    return Object.fromEntries(
        NOTIFICATION_CATEGORY_KEYS.map((key) => [key, { inApp: stored?.[key]?.inApp !== false, push: stored?.[key]?.push !== false }])
    ) as NotificationPreferences;
}

// Push notification titles; the body and link come from describeNotification() and notificationLink().
export const NOTIFICATION_TITLES: Record<NotificationType, string> = {
    comment_reply: "New reply",
    post_comment: "New comment",
    post_upvoted: "New upvote",
    comment_upvoted: "New upvote",
    post_approved: "Post approved",
    post_rejected: "Post rejected",
    post_submitted: "Post waiting for review",
    publish_request: "New request to publish",
    publish_request_approved: "You can publish now",
    publish_request_rejected: "Request to publish declined",
};

// Types notified at most once per actor and target (enforced by a unique partial index on Notification).
export const DEDUPED_NOTIFICATION_TYPES: readonly NotificationType[] = ["post_upvoted", "comment_upvoted"];

// Window event the notifications page fires after marking items read, so the bell refreshes its badge.
export const NOTIFICATIONS_CHANGED = "notifications-changed";

export interface NotificationView {
    id: string;
    type: NotificationType;
    read: boolean;
    createdAt: string;
    actorUsername: string | null;
    postTitle: string | null;
    postSlug: string | null;
    commentId: string | null;
}

export function describeNotification(n: NotificationView): string {
    const actor = n.actorUsername ?? "Someone";
    const title = n.postTitle ?? "a post";
    switch (n.type) {
        case "comment_reply":
            return `${actor} replied to your comment on "${title}"`;
        case "post_comment":
            return `${actor} commented on your post "${title}"`;
        case "post_upvoted":
            return `${actor} upvoted your post "${title}"`;
        case "comment_upvoted":
            return `${actor} upvoted your comment on "${title}"`;
        case "post_approved":
            return `Your post "${title}" was approved`;
        case "post_rejected":
            return `Your post "${title}" was rejected. Open it to see why and resubmit`;
        case "post_submitted":
            return `${actor} submitted "${title}" for review`;
        case "publish_request":
            return `${actor} asked to become an author`;
        case "publish_request_approved":
            return "Your request to publish was approved. You can write posts now";
        case "publish_request_rejected":
            return "Your request to publish was declined";
    }
}

export function notificationLink(n: Pick<NotificationView, "type" | "postSlug" | "commentId">): string {
    switch (n.type) {
        case "publish_request":
            return "/dashboard/admin/requests";
        case "post_submitted":
            return "/dashboard/admin/posts";
        case "post_rejected":
            return n.postSlug ? `/posts/${n.postSlug}/edit` : "/dashboard/posts";
        case "publish_request_approved":
            return "/posts/add";
        case "publish_request_rejected":
            return "/dashboard/posts";
        default:
            if (!n.postSlug) return "#";
            return n.commentId ? `/posts/${n.postSlug}#comment-${n.commentId}` : `/posts/${n.postSlug}`;
    }
}
