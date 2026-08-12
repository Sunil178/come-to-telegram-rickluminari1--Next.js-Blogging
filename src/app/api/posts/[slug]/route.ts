import { NextResponse } from "next/server";
import type { SoftDeleteModel } from "mongoose-delete";
import dbConnect from "@/libs/db-connect";
import Post, { IPost } from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";

// Post's exported type is loosened by `mongoose.models?.Post || mongoose.model<...>()`;
// narrow it back here so the soft-delete plugin's `.delete()` is visible.
const SoftDeletePost = Post as unknown as SoftDeleteModel<IPost>;

interface DeletePost {
    params: Promise<{
        slug: string;
    }>;
}

export const DELETE = withApiGuard<DeletePost>(async (request, { params, session }) => {
    try {
        const { slug } = await params;
        if (!slug) {
            return NextResponse.json({ data: null, message: 'Slug is required' }, { status: 400 });
        }

        await dbConnect();
        // mongoose-delete's types claim a DeleteResult, but `.delete()` actually runs an
        // `updateMany` under the hood (it flips `deleted: true` rather than removing the doc).
        const result = (await SoftDeletePost.delete(
            { slug, userId: session.user.id },
            session.user.id
        )) as unknown as { matchedCount: number };
        if (result.matchedCount === 0) {
            return NextResponse.json({ data: null, message: 'Post not found' }, { status: 404 });
        }

        return NextResponse.json({ data: null, message: 'Success' });
    } catch (error) {
        console.error('Failed to delete post:', error);
        return NextResponse.json({ data: null, message: 'Something went wrong' }, { status: 500 });
    }
});
