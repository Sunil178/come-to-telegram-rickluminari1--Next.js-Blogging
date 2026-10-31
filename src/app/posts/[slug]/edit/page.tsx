import Link from "next/link";
import { notFound } from "next/navigation";
import Post from "@/models/Post";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import PostForm from "@/components/posts/PostForm";

interface EditPostPageProps {
    params: Promise<{ slug: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
    const { slug } = await params;
    // proxy.ts (isGatedPath) redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const isAdmin = hasRole(session.user.role, ROLES.ADMIN);
    const post = await Post.findOne(isAdmin ? { slug } : { slug, userId: session.user.id }).lean();
    if (!post) notFound();

    return (
        <>
            <div className="mx-auto flex max-w-3xl justify-end px-6 pt-6">
                <Link href={`/posts/${post.slug}/revisions`} className="text-sm text-primary hover:underline">
                    Revision history
                </Link>
            </div>
            <PostForm
                mode="edit"
                initialPost={{
                    slug: post.slug,
                    title: post.title,
                    titleDescription: post.titleDescription,
                    tags: post.tags,
                    bannerImage: post.bannerImage,
                    contentHtml: post.content,
                    publishAt: post.publishAt ? new Date(post.publishAt).toISOString() : null,
                }}
            />
        </>
    );
}
