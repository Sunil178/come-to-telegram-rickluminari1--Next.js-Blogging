import { NextResponse } from "next/server";
import dbConnect from "@/libs/db-connect";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import { withApiGuard } from "@/libs/api-guard";

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

        await dbConnect();

        const post = await Post.findOne({ slug });
        if (!post) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }

        const isOwner = post.userId?.toString() === session.user.id;
        const isPubliclyVisible = post.approval === "Approved" && post.published && post.visibility;
        if (!isPubliclyVisible && !isOwner) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }

        if (parentId) {
            const parent = await Comment.findOne({ _id: parentId, postId: post._id });
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
        console.error("Failed to create comment:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
