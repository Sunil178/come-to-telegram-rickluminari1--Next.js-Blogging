import { NextResponse } from "next/server";
import Notification from "@/models/Notification";
import { withApiGuard } from "@/libs/api-guard";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;
        await Notification.updateOne({ _id: id, recipientId: session.user.id }, { $set: { read: true } });
        return NextResponse.json({ data: null, message: "Success" });
    } catch (error) {
        console.error("Failed to mark notification read:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
}, { objectIdParams: ["id"] });
