import { NextResponse } from "next/server";
import Post from "@/models/Post";
import PostVote from "@/models/PostVote";
import { withApiGuard } from "@/libs/api-guard";
import { toggleVote } from "@/libs/toggle-vote";

interface RouteContext {
    params: Promise<{ slug: string }>;
}

export const POST = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { slug } = await params;
        const body = await request.json().catch(() => null);
        if (typeof body?.type !== "boolean") {
            return NextResponse.json({ data: null, message: "type must be a boolean" }, { status: 400 });
        }

        const post = await Post.findOne({ slug });
        if (!post) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }

        const isOwner = post.userId?.toString() === session.user.id;
        const isPubliclyVisible = post.approval === "Approved" && post.published && post.visibility;
        if (!isPubliclyVisible && !isOwner) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }

        const result = await toggleVote({
            voteModel: PostVote,
            voteFilter: { userId: session.user.id, postId: post._id },
            counterModel: Post,
            counterId: post._id,
            type: body.type,
            voterId: session.user.id,
        });

        const updated = await Post.findById(post._id).select("upvoteCount downvoteCount").lean();

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
        console.error("Failed to toggle post vote:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
