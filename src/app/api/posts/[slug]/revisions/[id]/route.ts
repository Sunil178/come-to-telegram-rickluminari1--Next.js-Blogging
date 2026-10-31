import { after, NextResponse } from "next/server";
import Post from "@/models/Post";
import PostRevision from "@/models/PostRevision";
import { withApiGuard } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { recordRevision, REVISION_FIELDS } from "@/libs/post-revisions";
import { logger } from "@/libs/logger";

interface RouteContext {
    params: Promise<{ slug: string; id: string }>;
}

// Restores a revision's content onto the post (owner or admin), keeping the replaced version as a
// revision itself, so a restore can be undone the same way.
export const POST = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { slug, id } = await params;
        const isAdmin = hasRole(session.user.role, ROLES.ADMIN);
        const ownerFilter = isAdmin ? { slug } : { slug, userId: session.user.id };
        const post = await Post.findOne(ownerFilter).select("_id").lean<{ _id: unknown }>();
        if (!post) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }

        const revision = await PostRevision.findOne({ _id: id, postId: post._id }).lean<Record<string, unknown>>();
        if (!revision) {
            return NextResponse.json({ data: null, message: "Revision not found" }, { status: 404 });
        }

        const restored = Object.fromEntries(REVISION_FIELDS.map((field) => [field, revision[field]]));
        // "before": snapshot the version actually replaced, even if an edit landed since the read above.
        const replaced = await Post.findOneAndUpdate({ _id: post._id }, { $set: restored }, { returnDocument: "before" });
        if (!replaced) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }
        after(() => recordRevision(replaced, restored, session.user.id));

        return NextResponse.json({ data: { slug }, message: "Success" });
    } catch (error) {
        logger.error("Failed to restore a post revision", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
}, { objectIdParams: ["id"] });
