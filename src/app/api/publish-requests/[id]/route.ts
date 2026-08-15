import { NextResponse } from "next/server";
import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";

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
                { new: true }
            );

            if (!publishRequest) {
                return NextResponse.json({ data: null, message: "Request not found" }, { status: 404 });
            }

            if (action === "approve") {
                await User.updateOne({ _id: publishRequest.userId }, { role: "author" });
            }

            return NextResponse.json({ data: { id: publishRequest._id.toString(), status }, message: "Success" });
        } catch (error) {
            console.error("Failed to review publish request:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "admin" }
);
