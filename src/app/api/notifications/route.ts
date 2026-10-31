import { NextResponse } from "next/server";
import Notification from "@/models/Notification";
import User from "@/models/User";
import Post from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";

export const GET = withApiGuard(async (request, { session }) => {
    try {
        const [notifications, unreadCount] = await Promise.all([
            Notification.find({ recipientId: session.user.id })
                .sort({ createdAt: -1 })
                .limit(20)
                .populate({ path: "actorId", model: User, select: "username" })
                .populate({ path: "postId", model: Post, select: "title slug" })
                .lean(),
            Notification.countDocuments({ recipientId: session.user.id, read: false }),
        ]);

        const data = notifications.map((n) => {
            const actor = n.actorId as unknown as { username?: string } | null;
            const post = n.postId as unknown as { title?: string; slug?: string } | null;
            return {
                id: n._id.toString(),
                type: n.type,
                read: n.read,
                createdAt: n.createdAt,
                actorUsername: actor?.username ?? null,
                postTitle: post?.title ?? null,
                postSlug: post?.slug ?? null,
                commentId: n.commentId?.toString() ?? null,
            };
        });

        return NextResponse.json({ data: { notifications: data, unreadCount }, message: "Success" });
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
