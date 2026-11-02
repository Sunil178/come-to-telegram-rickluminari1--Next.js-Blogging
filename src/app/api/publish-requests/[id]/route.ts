import { after, NextResponse } from "next/server";
import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { logger } from "@/libs/logger";
import { notify } from "@/libs/notify";
import { markRequestNotificationsRead } from "@/libs/publish-request-notifications";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(
    async (request, { params, session }) => {
        try {
            const { id } = await params;
            const body = await request.json().catch(() => null);
            const action = body?.action;

            if (action !== "approve" && action !== "reject") {
                return NextResponse.json({ data: null, message: "action must be approve or reject" }, { status: 400 });
            }

            const status = action === "approve" ? "Approved" : "Rejected";
            const publishRequest = await PublishRequest.findOneAndUpdate(
                { _id: id, status: "Pending" },
                { status, reviewedBy: session.user.id, reviewedAt: new Date() },
                { returnDocument: "after" }
            );

            if (!publishRequest) {
                return NextResponse.json({ data: null, message: "Request not found" }, { status: 404 });
            }

            if (action === "approve") {
                const requester = await User.findById(publishRequest.userId).select("role");
                if (!requester || !hasRole(requester.role, ROLES.AUTHOR)) {
                    await User.updateOne({ _id: publishRequest.userId }, { role: ROLES.AUTHOR });
                }
            }

            await markRequestNotificationsRead(publishRequest.userId);

            const requesterId = publishRequest.userId.toString();
            after(() =>
                notify({
                    recipientId: requesterId,
                    actorId: session.user.id,
                    type: action === "approve" ? "publish_request_approved" : "publish_request_rejected",
                })
            );

            return NextResponse.json({ data: { id: publishRequest._id.toString(), status }, message: "Success" });
        } catch (error) {
            logger.error("Failed to review publish request", { error });
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: ROLES.ADMIN, objectIdParams: ["id"] }
);
