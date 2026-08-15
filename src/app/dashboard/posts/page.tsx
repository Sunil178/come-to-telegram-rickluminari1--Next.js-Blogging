import Link from "next/link";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { Button } from "@/components/ui/button";
import PostsManageView, { type PostsManageSearchParams } from "@/components/dashboard/PostsManageView";
import RequestPublishButton from "@/components/dashboard/RequestPublishButton";

interface DashboardPostsPageProps {
    searchParams: Promise<PostsManageSearchParams>;
}

export default async function DashboardPostsPage({ searchParams }: DashboardPostsPageProps) {
    // proxy.ts's matcher redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const resolvedSearchParams = await searchParams;

    return (
        <PostsManageView
            basePath="/dashboard/posts"
            heading="Manage Posts"
            scopeUserId={session.user.id}
            searchParams={resolvedSearchParams}
            composeControl={
                hasRole(session.user.role, ROLES.AUTHOR) ? (
                    <Button asChild>
                        <Link href="/posts/add">Add Post</Link>
                    </Button>
                ) : (
                    <RequestPublishButton />
                )
            }
        />
    );
}
