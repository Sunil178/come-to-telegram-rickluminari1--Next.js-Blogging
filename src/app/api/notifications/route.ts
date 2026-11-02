import { NextResponse } from "next/server";
import { withApiGuard } from "@/libs/api-guard";
import { listNotifications } from "@/libs/notification-feed";
import { logger } from "@/libs/logger";

// The bell: unread only, since a notification already read or handled has nothing left to act on there.
export const GET = withApiGuard(async (request, { session }) => {
    try {
        const { notifications, unreadCount } = await listNotifications(session.user.id, { limit: 20, unreadOnly: true });
        return NextResponse.json({ data: { notifications, unreadCount }, message: "Success" });
    } catch (error) {
        logger.error("Failed to fetch notifications", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
