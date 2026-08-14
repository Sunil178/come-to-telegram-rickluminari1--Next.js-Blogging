import { notFound } from "next/navigation";
import Post from "@/models/Post";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import PostForm from "@/components/posts/PostForm";

interface EditPostPageProps {
    params: Promise<{ slug: string }>;
}

export default async function EditPostPage({ params }: EditPostPageProps) {
    const { slug } = await params;
    // proxy.ts's matcher redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const post = await Post.findOne({ slug, userId: session.user.id }).lean();
    if (!post) notFound();

    return (
        <PostForm
            mode="edit"
            initialPost={{
                slug: post.slug,
                title: post.title,
                titleDescription: post.titleDescription,
                tags: post.tags,
                bannerImage: post.bannerImage,
                contentHtml: post.content,
            }}
        />
    );
}
