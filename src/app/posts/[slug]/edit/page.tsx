import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Post from "@/models/Post";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import PostForm from "@/components/posts/PostForm";
import { isPubliclyVisible } from "@/libs/post-visibility";
import { categoryOptions } from "@/libs/post-category";

interface EditPostPageProps {
    params: Promise<{ slug: string }>;
}

// Shared by generateMetadata and the page, so one request queries once.
const getEditablePost = cache(async (slug: string) => {
    // proxy.ts (isGatedPath) redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const isAdmin = hasRole(session.user.role, ROLES.ADMIN);
    const post = await Post.findOne(isAdmin ? { slug } : { slug, userId: session.user.id }).lean();
    return { session, post };
});

export async function generateMetadata({ params }: EditPostPageProps): Promise<Metadata> {
    const { post } = await getEditablePost((await params).slug);
    return { title: post ? `Edit: ${post.title}` : "Edit post", robots: { index: false } };
}

export default async function EditPostPage({ params }: EditPostPageProps) {
    const { session, post } = await getEditablePost((await params).slug);
    if (!post) notFound();
    const categories = await categoryOptions();

    return (
        <>
            <div className="mx-auto flex max-w-3xl justify-end px-6 pt-6">
                <Link href={`/posts/${post.slug}/revisions`} className="text-sm text-primary hover:underline">
                    Revision history
                </Link>
            </div>
            {post.approval === "Rejected" && (
                <div role="status" className="mx-auto mt-4 max-w-3xl px-6">
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-foreground">
                        <p className="font-medium text-destructive">A moderator rejected this post.</p>
                        {post.rejectionReason && <p className="mt-1 whitespace-pre-wrap">{post.rejectionReason}</p>}
                        {post.userId?.toString() === session.user.id && (
                            <p className="mt-1 text-muted-foreground">Saving your changes sends it back for review.</p>
                        )}
                    </div>
                </div>
            )}
            <PostForm
                mode="edit"
                categories={categories}
                userId={session.user.id}
                isLive={isPubliclyVisible(post)}
                initialPost={{
                    slug: post.slug,
                    title: post.title,
                    titleDescription: post.titleDescription,
                    tags: post.tags,
                    bannerImage: post.bannerImage,
                    contentHtml: post.content,
                    publishAt: post.publishAt ? new Date(post.publishAt).toISOString() : null,
                    categoryId: post.categoryId ? post.categoryId.toString() : null,
                }}
            />
        </>
    );
}
