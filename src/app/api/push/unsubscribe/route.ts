import { NextResponse } from "next/server";
import PushSubscription from "@/models/PushSubscription";
import { withApiGuard } from "@/libs/api-guard";
import { logger } from "@/libs/logger";

export const POST = withApiGuard(async (request, { session }) => {
    try {
        const body = await request.json().catch(() => null);
        const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
        if (!endpoint) {
            return NextResponse.json({ data: null, message: "endpoint is required" }, { status: 400 });
        }

        await PushSubscription.deleteOne({ endpoint, userId: session.user.id });
        return NextResponse.json({ data: null, message: "Success" });
    } catch (error) {
        logger.error("Failed to remove push subscription", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
