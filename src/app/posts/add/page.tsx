import PostForm from "@/components/posts/PostForm";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { categoryOptions } from "@/libs/post-category";

export default async function AddPostPage() {
    // proxy.ts (isGatedPath) redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    return <PostForm mode="create" userId={session.user.id} categories={await categoryOptions()} />;
}
