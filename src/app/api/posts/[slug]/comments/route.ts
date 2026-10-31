import { NextResponse, after } from "next/server";
import { isValidObjectId } from "mongoose";
import type { SoftDeleteModel } from "mongoose-delete";
import type { IComment } from "@/models/Comment";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import { withApiGuard } from "@/libs/api-guard";
import { notify } from "@/libs/notify";
import { logger } from "@/libs/logger";

const SoftDeleteComment = Comment as unknown as SoftDeleteModel<IComment>;

interface RouteContext {
    params: Promise<{ slug: string }>;
}

export const POST = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { slug } = await params;
        const body = await request.json().catch(() => null);
        const content = typeof body?.content === "string" ? body.content.trim() : "";
        const parentId = typeof body?.parentId === "string" ? body.parentId : null;

        if (!content) {
            return NextResponse.json({ data: null, message: "Comment can't be empty" }, { status: 400 });
        }
        if (content.length > 5000) {
            return NextResponse.json({ data: null, message: "Comment is too long (max 5000 characters)" }, { status: 400 });
        }
        if (parentId && !isValidObjectId(parentId)) {
            return NextResponse.json({ data: null, message: "Parent comment not found" }, { status: 400 });
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

        let parent = null;
        if (parentId) {
            parent = await SoftDeleteComment.findOneWithDeleted({ _id: parentId, postId: post._id });
            if (!parent) {
                return NextResponse.json({ data: null, message: "Parent comment not found" }, { status: 400 });
            }
        }

        const comment = await Comment.create({
            postId: post._id,
            parentId: parentId || null,
            userId: session.user.id,
            content,
        });

        await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });

        const parentAuthorId = parent && !parent.deleted ? parent.userId.toString() : null;
        const postAuthorId = post.userId?.toString();

        if (parentAuthorId) {
            after(() =>
                notify({
                    recipientId: parentAuthorId,
                    actorId: session.user.id,
                    type: "comment_reply",
                    postId: post._id.toString(),
                    commentId: comment._id.toString(),
                    title: "New reply",
                    body: `Someone replied to your comment on "${post.title}"`,
                    url: `/posts/${post.slug}#comment-${comment._id}`,
                })
            );
        }

        // Skip when the reply's parent is already the post's author -- they'd get the comment_reply
        // notification above for the same comment, and a second one here would be a duplicate.
        if (postAuthorId && postAuthorId !== parentAuthorId) {
            after(() =>
                notify({
                    recipientId: postAuthorId,
                    actorId: session.user.id,
                    type: "post_comment",
                    postId: post._id.toString(),
                    commentId: comment._id.toString(),
                    title: "New comment",
                    body: `Someone commented on your post "${post.title}"`,
                    url: `/posts/${post.slug}#comment-${comment._id}`,
                })
            );
        }

        return NextResponse.json({
            data: {
                id: comment._id.toString(),
                parentId,
                content: comment.content,
                createdAt: comment.createdAt.toISOString(),
            },
            message: "Success",
        });
    } catch (error) {
        logger.error("Failed to create comment", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
}, { rateLimit: { points: 10, duration: 60 } });
