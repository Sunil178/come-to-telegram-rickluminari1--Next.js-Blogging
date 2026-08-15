import { NextResponse } from "next/server";
import type { SoftDeleteModel } from "mongoose-delete";
import Post, { IPost } from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";
import { slugify } from "@/libs/slug";
import { parsePostEditorValue, serializePostContent } from "@/libs/post-editor-serialize";
import { hasRole, ROLES } from "@/libs/roles";

// Post's exported type is loosened by `mongoose.models?.Post || mongoose.model<...>()`;
// narrow it back here so the soft-delete plugin's `.delete()` is visible.
const SoftDeletePost = Post as unknown as SoftDeleteModel<IPost>;

interface RouteContext {
    params: Promise<{
        slug: string;
    }>;
}

export const PATCH = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { slug: currentSlug } = await params;
        if (!currentSlug) {
            return NextResponse.json({ data: null, message: 'Slug is required' }, { status: 400 });
        }

        const body = await request.formData();

        const title = (body.get('title') as string || '').trim();
        if (!title) {
            return NextResponse.json({ data: null, message: 'Title is required' }, { status: 400 });
        }

        const nextSlug = ((body.get('slug') as string) || '').trim() || slugify(title);
        if (!nextSlug) {
            return NextResponse.json({ data: null, message: 'Slug is required' }, { status: 400 });
        }

        const value = parsePostEditorValue(body.get('post_data'));
        if (!value) {
            return NextResponse.json({ data: null, message: 'Post content is required' }, { status: 400 });
        }

        const isAdmin = hasRole(session.user.role, ROLES.ADMIN);
        const post = await Post.findOneAndUpdate(
            isAdmin ? { slug: currentSlug } : { slug: currentSlug, userId: session.user.id },
            {
                slug: nextSlug,
                title,
                titleDescription: body.get('titleDescription'),
                tags: (body.get('tags') as string)?.split(',').filter(Boolean) ?? [],
                bannerImage: body.get('postBannerPath'),
                content: await serializePostContent(value),
            },
            { new: true }
        );

        if (!post) {
            return NextResponse.json({ data: null, message: 'Post not found' }, { status: 404 });
        }

        return NextResponse.json({ data: { slug: post.slug }, message: 'Success' });
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            return NextResponse.json({ data: null, message: 'A post with this slug already exists. Please choose a different slug.' }, { status: 409 });
        }
        console.error('Failed to update post:', error);
        return NextResponse.json({ data: null, message: 'Something went wrong' }, { status: 500 });
    }
});

export const DELETE = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { slug } = await params;
        if (!slug) {
            return NextResponse.json({ data: null, message: 'Slug is required' }, { status: 400 });
        }

        const isAdmin = hasRole(session.user.role, ROLES.ADMIN);

        // mongoose-delete's types claim a DeleteResult, but `.delete()` actually runs an
        // `updateMany` under the hood (it flips `deleted: true` rather than removing the doc).
        const result = (await SoftDeletePost.delete(
            isAdmin ? { slug } : { slug, userId: session.user.id },
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
