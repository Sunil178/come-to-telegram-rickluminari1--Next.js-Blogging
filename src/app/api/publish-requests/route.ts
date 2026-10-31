import { after, NextResponse } from "next/server";
import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { logger } from "@/libs/logger";
import { notify } from "@/libs/notify";

export const POST = withApiGuard(async (request, { session }) => {
    try {
        const user = await User.findById(session.user.id).select("role");
        if (!user || hasRole(user.role, ROLES.AUTHOR)) {
            return NextResponse.json({ data: null, message: "Only Readers can request to publish" }, { status: 400 });
        }

        const existing = await PublishRequest.findOne({ userId: session.user.id, status: "Pending" });
        if (existing) {
            return NextResponse.json({ data: null, message: "You already have a pending request" }, { status: 400 });
        }

        const publishRequest = await PublishRequest.create({ userId: session.user.id });
        // Only admins can review requests (PATCH /api/publish-requests/[id]), so only they are told.
        after(async () => {
            try {
                const admins = await User.find({ role: ROLES.ADMIN }).select("_id").lean();
                await Promise.all(admins.map((admin) =>
                    notify({
                        recipientId: admin._id.toString(),
                        actorId: session.user.id,
                        actorUsername: session.user.username,
                        type: "publish_request",
                    })
                ));
            } catch (error) {
                logger.error("Failed to notify admins of a publish request", { error });
            }
        });
        return NextResponse.json({ data: { id: publishRequest._id.toString() }, message: "Success" });
    } catch (error) {
        logger.error("Failed to create publish request", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
