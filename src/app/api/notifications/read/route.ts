import { NextResponse } from "next/server";
import Notification from "@/models/Notification";
import { withApiGuard } from "@/libs/api-guard";

export const PATCH = withApiGuard(async (request, { session }) => {
    try {
        await Notification.updateMany({ recipientId: session.user.id, read: false }, { $set: { read: true } });
        return NextResponse.json({ data: null, message: "Success" });
    } catch (error) {
        console.error("Failed to mark notifications read:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
