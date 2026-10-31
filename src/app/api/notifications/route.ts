import { NextResponse } from "next/server";
import { withApiGuard } from "@/libs/api-guard";
import { listNotifications } from "@/libs/notification-feed";
import { logger } from "@/libs/logger";

export const GET = withApiGuard(async (request, { session }) => {
    try {
        const { notifications, unreadCount } = await listNotifications(session.user.id, { limit: 20 });
        return NextResponse.json({ data: { notifications, unreadCount }, message: "Success" });
    } catch (error) {
        logger.error("Failed to fetch notifications", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
