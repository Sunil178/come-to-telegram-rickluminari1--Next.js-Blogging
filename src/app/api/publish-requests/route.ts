import { NextResponse } from "next/server";
import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import { hasRole } from "@/libs/roles";

export const POST = withApiGuard(async (request, { session }) => {
    try {
        const user = await User.findById(session.user.id).select("role");
        if (!user || hasRole(user.role, "author")) {
            return NextResponse.json({ data: null, message: "Only Readers can request to publish" }, { status: 400 });
        }

        const existing = await PublishRequest.findOne({ userId: session.user.id, status: "Pending" });
        if (existing) {
            return NextResponse.json({ data: null, message: "You already have a pending request" }, { status: 400 });
        }

        const publishRequest = await PublishRequest.create({ userId: session.user.id });
        return NextResponse.json({ data: { id: publishRequest._id.toString() }, message: "Success" });
    } catch (error) {
        console.error("Failed to create publish request:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
