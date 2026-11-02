import { NextResponse, after } from "next/server";
import Post, { ApprovalStatus } from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";
import { ROLES } from "@/libs/roles";
import { notify } from "@/libs/notify";
import { logger } from "@/libs/logger";
import { markPostReviewNotificationsRead } from "@/libs/review-notifications";

const MAX_REASON_LENGTH = 1000;

interface RouteContext {
    params: Promise<{ slug: string }>;
}

export const PATCH = withApiGuard<RouteContext>(
    async (request, { params, session }) => {
        try {
            const { slug } = await params;
            const body = await request.json().catch(() => null);
            const approval = body?.approval;

            if (approval !== ApprovalStatus.Approved && approval !== ApprovalStatus.Rejected) {
                return NextResponse.json({ data: null, message: "approval must be Approved or Rejected" }, { status: 400 });
            }

            const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
            if (reason.length > MAX_REASON_LENGTH) {
                return NextResponse.json({ data: null, message: `The reason can be at most ${MAX_REASON_LENGTH} characters` }, { status: 400 });
            }

            const update: Record<string, unknown> = {
                approval,
                approvedAt: approval === ApprovalStatus.Approved ? new Date() : null,
                // Shown to the author on the edit page, so they know what to change before resubmitting.
                rejectionReason: approval === ApprovalStatus.Rejected && reason ? { $literal: reason } : null,
            };
            if (approval === ApprovalStatus.Approved) {
                update.published = true;
                // A scheduled post goes live at its publishAt; approving after that time publishes now.
                // The app's clock, which visibility checks also use.
                const now = new Date();
                update.publishedAt = { $max: [now, { $ifNull: ["$publishAt", now] }] };
            }

            // Returns the pre-update document, so a repeat click (or a second moderator) still applies
            // the update (re-approving publishes) but doesn't re-notify the author.
            const post = await Post.findOneAndUpdate({ slug }, [{ $set: update }], { returnDocument: "before", updatePipeline: true });

            if (!post) {
                return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
            }

            after(() => markPostReviewNotificationsRead(post._id));

            const recipientId = post.userId?.toString();
            if (recipientId && post.approval !== approval) {
                after(() =>
                    notify({
                        recipientId,
                        actorId: session.user.id,
                        postTitle: post.title,
                        postSlug: post.slug,
                        type: approval === ApprovalStatus.Approved ? "post_approved" : "post_rejected",
                        postId: post._id.toString(),
                    })
                );
            }

            return NextResponse.json({ data: { slug: post.slug, approval }, message: "Success" });
        } catch (error) {
            logger.error("Failed to update post approval", { error });
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: ROLES.MODERATOR }
);
