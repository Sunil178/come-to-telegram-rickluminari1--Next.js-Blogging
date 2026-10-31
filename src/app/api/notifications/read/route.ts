import { NextResponse } from "next/server";
import Notification from "@/models/Notification";
import { withApiGuard } from "@/libs/api-guard";
import { logger } from "@/libs/logger";

export const PATCH = withApiGuard(async (request, { session }) => {
    try {
        await Notification.updateMany({ recipientId: session.user.id, read: false }, { $set: { read: true, readAt: new Date() } });
        return NextResponse.json({ data: null, message: "Success" });
    } catch (error) {
        logger.error("Failed to mark notifications read", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
