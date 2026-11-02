import { cache } from "react";
import Post from "@/models/Post";
import User from "@/models/User";
import Category from "@/models/Category";
import { getSession } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { isPubliclyVisible } from "@/libs/post-visibility";

/** The post at this slug if the viewer may see it, else null; cached per request for the layout, metadata and page. */
export const getViewablePost = cache(async (slug: string) => {
    const post = await Post.findOne({ slug })
        .populate({ path: "userId", model: User, select: "username" })
        .populate({ path: "categoryId", model: Category, select: "title slug visibility" })
        .lean();
    if (!post) return null;

    const isPublic = isPubliclyVisible(post);
    if (isPublic) return post;

    const session = await getSession();
    if (hasRole(session?.user?.role, ROLES.MODERATOR)) return post;

    const owner = post.userId as unknown as { _id?: { toString(): string } } | null;
    if (session?.user?.id && owner?._id && owner._id.toString() === session.user.id) {
        return post;
    }

    return null;
});
