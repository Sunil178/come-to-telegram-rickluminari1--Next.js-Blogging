import { after, NextResponse } from "next/server";
import type { SoftDeleteModel } from "mongoose-delete";
import Post, { IPost } from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";
import { slugify } from "@/libs/slug";
import { parsePostEditorValue, serializePostContent } from "@/libs/post-editor-serialize";
import { hasRole, ROLES } from "@/libs/roles";
import { logger } from "@/libs/logger";
import { parsePublishAt, rescheduledPublishedAt } from "@/libs/post-schedule";
import { recordRevision } from "@/libs/post-revisions";

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

        // Always run the client-supplied slug through slugify() too — see src/app/api/posts/route.ts.
        const nextSlug = slugify((body.get('slug') as string) || '') || slugify(title);
        if (!nextSlug) {
            return NextResponse.json({ data: null, message: 'Slug is required' }, { status: 400 });
        }

        const value = parsePostEditorValue(body.get('post_data'));
        if (!value) {
            return NextResponse.json({ data: null, message: 'Post content is required' }, { status: 400 });
        }

        const publishAt = parsePublishAt(body.get('publishAt'));
        if (!publishAt.ok) {
            return NextResponse.json({ data: null, message: 'Publish time must be a valid date within a year' }, { status: 400 });
        }

        const isAdmin = hasRole(session.user.role, ROLES.ADMIN);
        const changes = {
            slug: nextSlug,
            title,
            titleDescription: body.get('titleDescription'),
            tags: (body.get('tags') as string)?.split(',').filter(Boolean) ?? [],
            bannerImage: body.get('postBannerPath'),
            content: await serializePostContent(value),
            publishAt: publishAt.value,
        };
        // One pipeline update, so the edit and the schedule change land together. $literal keeps
        // user text such as a "$100 tips" title from being read as a field path. "before" returns
        // the replaced version for the revision history.
        const previous = await Post.findOneAndUpdate(
            isAdmin ? { slug: currentSlug } : { slug: currentSlug, userId: session.user.id },
            [{
                $set: {
                    ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, { $literal: value }])),
                    // Already approved: editing the schedule moves its go-live time (see rescheduledPublishedAt).
                    publishedAt: { $cond: [{ $eq: ["$approval", "Approved"] }, rescheduledPublishedAt(publishAt.value), "$publishedAt"] },
                },
            }],
            { returnDocument: "before", updatePipeline: true }
        );

        if (!previous) {
            return NextResponse.json({ data: null, message: 'Post not found' }, { status: 404 });
        }

        // Off the save path; recordRevision never throws.
        after(() => recordRevision(previous, changes, session.user.id));

        return NextResponse.json({ data: { slug: nextSlug }, message: 'Success' });
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            return NextResponse.json({ data: null, message: 'A post with this slug already exists. Please choose a different slug.' }, { status: 409 });
        }
        logger.error("Failed to update post", { error });
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
        logger.error("Failed to delete post", { error });
        return NextResponse.json({ data: null, message: 'Something went wrong' }, { status: 500 });
    }
});
