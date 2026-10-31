import { NextResponse } from "next/server";
import Notification from "@/models/Notification";
import { withApiGuard } from "@/libs/api-guard";
import { logger } from "@/libs/logger";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;
        // read: false in the filter keeps readAt (and so the TTL clock) from restarting on repeat clicks.
        await Notification.updateOne({ _id: id, recipientId: session.user.id, read: false }, { $set: { read: true, readAt: new Date() } });
        return NextResponse.json({ data: null, message: "Success" });
    } catch (error) {
        logger.error("Failed to mark notification read", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
}, { objectIdParams: ["id"] });
