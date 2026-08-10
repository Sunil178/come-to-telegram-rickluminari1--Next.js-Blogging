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
        await SoftDeletePost.delete({ slug }, session.user.id);

        return NextResponse.json({ data: null, message: 'Success' });
    } catch (error) {
        console.error('Failed to delete post:', error);
        return NextResponse.json({ data: null, message: 'Something went wrong' }, { status: 500 });
    }
});
