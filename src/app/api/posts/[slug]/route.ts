import { after, NextResponse } from "next/server";
import { Types } from "mongoose";
import type { SoftDeleteModel } from "mongoose-delete";
import Post, { ApprovalStatus, IPost } from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";
import { slugify } from "@/libs/slug";
import { parsePostEditorValue, serializePostContent } from "@/libs/post-editor-serialize";
import { hasRole, ROLES } from "@/libs/roles";
import { logger } from "@/libs/logger";
import { parsePublishAt, rescheduledPublishedAt } from "@/libs/post-schedule";
import { recordRevision } from "@/libs/post-revisions";
import { parseCategoryId } from "@/libs/post-category";
import { markPostReviewNotificationsRead, notifyPostSubmitted, removePostReviewNotifications } from "@/libs/review-notifications";
import { manageablePostFilter } from "@/libs/post-visibility";
import { postUploadUrls, syncUploadPrivacy } from "@/libs/upload-privacy";

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

        const category = await parseCategoryId(body.get('categoryId'));
        if (!category.ok) {
            return NextResponse.json({ data: null, message: 'Choose one of the listed categories' }, { status: 400 });
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
            categoryId: category.value,
        };
        const isPrivate = body.get('private') === 'true';
        const byAuthor = { $eq: ["$userId", new Types.ObjectId(session.user.id)] };
        // The author's edit of a rejected post resubmits it; an admin editing someone else's post doesn't.
        const resubmits = isPrivate ? false : { $and: [{ $eq: ["$approval", ApprovalStatus.Rejected] }, byAuthor] };
        // The author sharing a private post again sends it to review: its content was never checked while private.
        const reshares = isPrivate ? false : { $and: [{ $eq: ["$visibility", false] }, byAuthor] };
        const toReview = { $or: [resubmits, reshares] };
        // One pipeline update, so the edit and the schedule change land together. $literal keeps
        // user text such as a "$100 tips" title from being read as a field path. "before" returns
        // the replaced version for the revision history.
        const previous = await Post.findOneAndUpdate(
            { slug: currentSlug, ...manageablePostFilter(session.user.id, isAdmin) },
            [{
                $set: {
                    ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, { $literal: value }])),
                    // Already approved: editing the schedule moves its go-live time (see rescheduledPublishedAt).
                    publishedAt: { $cond: [{ $and: [{ $eq: ["$approval", "Approved"] }, { $not: [toReview] }] }, rescheduledPublishedAt(publishAt.value), "$publishedAt"] },
                    approval: { $cond: [toReview, ApprovalStatus.Pending, "$approval"] },
                    rejectionReason: { $cond: [toReview, null, "$rejectionReason"] },
                    // Only the author makes a post private or shares it again.
                    visibility: { $cond: [byAuthor, !isPrivate, "$visibility"] },
                },
            }],
            { returnDocument: "before", updatePipeline: true }
        );

        if (!previous) {
            return NextResponse.json({ data: null, message: 'Post not found' }, { status: 404 });
        }

        // Off the save path; recordRevision never throws.
        after(() => recordRevision(previous, changes, session.user.id));
        const isAuthor = previous.userId?.toString() === session.user.id;
        const nowPrivate = isAuthor ? isPrivate : !previous.visibility;
        // Image access only changes with the post's images or its privacy.
        const before = postUploadUrls(previous);
        const nextImages = postUploadUrls({ bannerImage: changes.bannerImage as string | null, content: changes.content });
        const sameImages = before.length === nextImages.length && before.every((url) => nextImages.includes(url));
        if (!sameImages || Boolean(previous.visibility) === nowPrivate) after(() => syncUploadPrivacy([...before, ...nextImages]));
        const submitted = { id: previous._id.toString(), title, slug: nextSlug };
        if (nowPrivate) {
            // A post made private leaves the review queue, and staff notifications that named it go.
            if (previous.visibility) after(() => removePostReviewNotifications(previous._id));
        } else if (isAuthor && (previous.approval === ApprovalStatus.Rejected || !previous.visibility)) {
            // A resubmitted rejection, or a private post shared again, goes (back) to review.
            after(() => notifyPostSubmitted(submitted, { id: session.user.id, username: session.user.username }));
        }

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
        const filter = { slug, ...manageablePostFilter(session.user.id, isAdmin) };
        const target = await Post.findOne(filter).select("_id bannerImage content").lean<{ _id: Types.ObjectId; bannerImage?: string; content?: string }>();
        const result = (await SoftDeletePost.delete(filter, session.user.id)) as unknown as { matchedCount: number };
        if (!target || result.matchedCount === 0) {
            return NextResponse.json({ data: null, message: 'Post not found' }, { status: 404 });
        }
        // A deleted post no longer waits for review; images only its author's private posts still use turn private.
        after(() => markPostReviewNotificationsRead(target._id));
        after(() => syncUploadPrivacy(postUploadUrls(target)));

        return NextResponse.json({ data: null, message: 'Success' });
    } catch (error) {
        logger.error("Failed to delete post", { error });
        return NextResponse.json({ data: null, message: 'Something went wrong' }, { status: 500 });
    }
});
