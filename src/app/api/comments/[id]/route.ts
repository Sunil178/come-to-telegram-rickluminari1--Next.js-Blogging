import { NextResponse } from "next/server";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import { withApiGuard } from "@/libs/api-guard";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => null);
        const content = typeof body?.content === "string" ? body.content.trim() : "";
        if (!content) {
            return NextResponse.json({ data: null, message: "Comment can't be empty" }, { status: 400 });
        }
        if (content.length > 5000) {
            return NextResponse.json({ data: null, message: "Comment is too long (max 5000 characters)" }, { status: 400 });
        }

        const comment = await Comment.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { content, editedAt: new Date() },
            { new: true }
        );

        if (!comment) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        return NextResponse.json({
            data: { id: comment._id.toString(), content: comment.content, editedAt: comment.editedAt?.toISOString() ?? null },
            message: "Success",
        });
    } catch (error) {
        console.error("Failed to update comment:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});

export const DELETE = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;

        const comment = await Comment.findOne({ _id: id, userId: session.user.id });
        if (!comment) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        await comment.delete(session.user.id);
        await Post.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });

        return NextResponse.json({ data: null, message: "Success" });
    } catch (error) {
        console.error("Failed to delete comment:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
