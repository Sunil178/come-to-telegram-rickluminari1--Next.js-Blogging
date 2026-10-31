import Notification from "@/models/Notification";
import User from "@/models/User";
import Post from "@/models/Post";
import type { NotificationView } from "@/libs/notification-types";

// Muted rows are deduplication records for categories with in-app turned off; never shown or counted.
const visibleTo = (userId: string) => ({ recipientId: userId, muted: { $ne: true } });

export function countNotifications(userId: string): Promise<number> {
    return Notification.countDocuments(visibleTo(userId));
}

export async function listNotifications(userId: string, { page = 1, limit = 20 } = {}) {
    const [docs, unreadCount] = await Promise.all([
        Notification.find(visibleTo(userId))
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate({ path: "actorId", model: User, select: "username" })
            .populate({ path: "postId", model: Post, select: "title slug" })
            .lean(),
        Notification.countDocuments({ ...visibleTo(userId), read: false }),
    ]);

    const notifications: NotificationView[] = docs.map((n) => {
        const actor = n.actorId as unknown as { username?: string } | null;
        const post = n.postId as unknown as { title?: string; slug?: string } | null;
        return {
            id: n._id.toString(),
            type: n.type,
            read: n.read,
            createdAt: new Date(n.createdAt).toISOString(),
            actorUsername: actor?.username ?? null,
            postTitle: post?.title ?? null,
            postSlug: post?.slug ?? null,
            commentId: n.commentId?.toString() ?? null,
        };
    });
    return { notifications, unreadCount };
}
