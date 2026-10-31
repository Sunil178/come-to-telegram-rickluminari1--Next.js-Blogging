import { NextResponse, after } from "next/server";
import Post, { ApprovalStatus } from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";
import { ROLES } from "@/libs/roles";
import { notify } from "@/libs/notify";

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

            const update: Record<string, unknown> = {
                approval,
                approvedAt: approval === ApprovalStatus.Approved ? new Date() : null,
            };
            if (approval === ApprovalStatus.Approved) {
                update.published = true;
                update.publishedAt = new Date();
            }

            // Returns the pre-update document, so a repeat click (or a second moderator) still applies
            // the update (re-approving publishes) but doesn't re-notify the author.
            const post = await Post.findOneAndUpdate({ slug }, update, { new: false });

            if (!post) {
                return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
            }

            const recipientId = post.userId?.toString();
            if (recipientId && post.approval !== approval) {
                after(() =>
                    notify({
                        recipientId,
                        actorId: session.user.id,
                        type: approval === ApprovalStatus.Approved ? "post_approved" : "post_rejected",
                        postId: post._id.toString(),
                        title: approval === ApprovalStatus.Approved ? "Post approved" : "Post rejected",
                        body: `Your post "${post.title}" was ${approval === ApprovalStatus.Approved ? "approved" : "rejected"}`,
                        url: `/posts/${post.slug}`,
                    })
                );
            }

            return NextResponse.json({ data: { slug: post.slug, approval }, message: "Success" });
        } catch (error) {
            console.error("Failed to update post approval:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: ROLES.MODERATOR }
);
