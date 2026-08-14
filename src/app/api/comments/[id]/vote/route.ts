import { NextResponse } from "next/server";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import CommentVote from "@/models/CommentVote";
import { withApiGuard } from "@/libs/api-guard";
import { toggleVote } from "@/libs/toggle-vote";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const POST = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => null);
        if (typeof body?.type !== "boolean") {
            return NextResponse.json({ data: null, message: "type must be a boolean" }, { status: 400 });
        }

        const comment = await Comment.findById(id);
        if (!comment) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        const post = await Post.findById(comment.postId);
        if (!post) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        const isOwner = post.userId?.toString() === session.user.id;
        const isPubliclyVisible = post.approval === "Approved" && post.published && post.visibility;
        if (!isPubliclyVisible && !isOwner) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        const result = await toggleVote({
            voteModel: CommentVote,
            voteFilter: { userId: session.user.id, commentId: comment._id },
            counterModel: Comment,
            counterId: comment._id,
            type: body.type,
            voterId: session.user.id,
        });

        const updated = await Comment.findById(comment._id).select("upvoteCount downvoteCount").lean();

        return NextResponse.json({
            data: {
                action: result.action,
                myVote: result.currentType,
                upvoteCount: updated?.upvoteCount ?? 0,
                downvoteCount: updated?.downvoteCount ?? 0,
            },
            message: "Success",
        });
    } catch (error) {
        console.error("Failed to toggle comment vote:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
