import { after, NextResponse } from "next/server";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import CommentVote from "@/models/CommentVote";
import { withApiGuard } from "@/libs/api-guard";
import { toggleVote } from "@/libs/toggle-vote";
import { logger } from "@/libs/logger";
import { notify } from "@/libs/notify";
import { isPubliclyVisible } from "@/libs/post-visibility";

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
        const isPublic = isPubliclyVisible(post);
        if (!isPublic && !isOwner) {
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

        const commentAuthorId = comment.userId?.toString();
        if (commentAuthorId && result.currentType === true) {
            after(() =>
                notify({
                    recipientId: commentAuthorId,
                    actorId: session.user.id,
                    actorUsername: session.user.username,
                    postTitle: post.title,
                    postSlug: post.slug,
                    type: "comment_upvoted",
                    postId: post._id.toString(),
                    commentId: comment._id.toString(),
                })
            );
        }

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
        logger.error("Failed to toggle comment vote", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
}, { objectIdParams: ["id"] });
