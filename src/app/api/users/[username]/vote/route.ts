import { NextResponse } from "next/server";
import User from "@/models/User";
import UserVote from "@/models/UserVote";
import { withApiGuard } from "@/libs/api-guard";
import { toggleVote } from "@/libs/toggle-vote";
import { logger } from "@/libs/logger";

interface RouteContext {
    params: Promise<{ username: string }>;
}

export const POST = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { username } = await params;
        const body = await request.json().catch(() => null);
        if (typeof body?.type !== "boolean") {
            return NextResponse.json({ data: null, message: "type must be a boolean" }, { status: 400 });
        }

        const targetUser = await User.findOne({ username: decodeURIComponent(username) });
        if (!targetUser) {
            return NextResponse.json({ data: null, message: "User not found" }, { status: 404 });
        }

        if (targetUser._id.toString() === session.user.id) {
            return NextResponse.json({ data: null, message: "You can't vote on your own profile" }, { status: 400 });
        }

        const result = await toggleVote({
            voteModel: UserVote,
            voteFilter: { userId: session.user.id, targetUserId: targetUser._id },
            targetFilter: { targetUserId: targetUser._id },
            counterModel: User,
            counterId: targetUser._id,
            type: body.type,
            voterId: session.user.id,
        });

        return NextResponse.json({
            data: {
                action: result.action,
                myVote: result.currentType,
                upvoteCount: result.upvoteCount,
                downvoteCount: result.downvoteCount,
            },
            message: "Success",
        });
    } catch (error) {
        logger.error("Failed to toggle user vote", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
