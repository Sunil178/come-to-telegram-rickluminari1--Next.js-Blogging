import { NextResponse } from "next/server";
import Post, { ApprovalStatus } from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";
import { ROLES } from "@/libs/roles";

interface RouteContext {
    params: Promise<{ slug: string }>;
}

export const PATCH = withApiGuard<RouteContext>(
    async (request, { params }) => {
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

            const post = await Post.findOneAndUpdate({ slug }, update, { new: true });

            if (!post) {
                return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
            }

            return NextResponse.json({ data: { slug: post.slug, approval: post.approval }, message: "Success" });
        } catch (error) {
            console.error("Failed to update post approval:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: ROLES.MODERATOR }
);
