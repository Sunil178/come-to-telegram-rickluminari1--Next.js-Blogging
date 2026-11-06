import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import type { SoftDeleteModel } from "mongoose-delete";
import Post, { type IPost } from "@/models/Post";
import Comment from "@/models/Comment";
import { withApiGuard } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { logger } from "@/libs/logger";
import { commentsEnabled } from "@/libs/runtime-config";

// A private post's comments are its author's alone, like the post (deleted posts included).
async function underOthersPrivatePost(postId: Types.ObjectId, userId: string): Promise<boolean> {
    const post = await (Post as unknown as SoftDeleteModel<IPost>).findOneWithDeleted({ _id: postId }).select("visibility userId").lean<{ visibility: boolean; userId?: { toString(): string } }>();
    return post?.visibility === false && post.userId?.toString() !== userId;
}

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        if (!commentsEnabled()) {
            return NextResponse.json({ data: null, message: "Comments are turned off" }, { status: 403 });
        }
        const { id } = await params;
        const body = await request.json().catch(() => null);
        const content = typeof body?.content === "string" ? body.content.trim() : "";
        if (!content) {
            return NextResponse.json({ data: null, message: "Comment can't be empty" }, { status: 400 });
        }
        if (content.length > 5000) {
            return NextResponse.json({ data: null, message: "Comment is too long (max 5000 characters)" }, { status: 400 });
        }

        const own = await Comment.findOne({ _id: id, userId: session.user.id }).select("postId").lean<{ postId: Types.ObjectId }>();
        const comment = own && !(await underOthersPrivatePost(own.postId, session.user.id))
            ? await Comment.findOneAndUpdate({ _id: id, userId: session.user.id }, { content, editedAt: new Date() }, { returnDocument: "after" })
            : null;

        if (!comment) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        return NextResponse.json({
            data: { id: comment._id.toString(), content: comment.content, editedAt: comment.editedAt?.toISOString() ?? null },
            message: "Success",
        });
    } catch (error) {
        logger.error("Failed to update comment", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
}, { objectIdParams: ["id"] });

export const DELETE = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;
        const filter = hasRole(session.user.role, ROLES.MODERATOR) ? { _id: id } : { _id: id, userId: session.user.id };

        const comment = await Comment.findOne(filter);
        const othersComment = comment && comment.userId?.toString() !== session.user.id;
        if (!comment || (othersComment && (await underOthersPrivatePost(comment.postId, session.user.id)))) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        await comment.delete(session.user.id);
        await Post.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });

        return NextResponse.json({ data: null, message: "Success" });
    } catch (error) {
        logger.error("Failed to delete comment", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
}, { objectIdParams: ["id"] });
