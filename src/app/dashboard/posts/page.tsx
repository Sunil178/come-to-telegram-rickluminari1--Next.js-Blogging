import Link from "next/link";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { Button } from "@/components/ui/button";
import PostsManageView, { type PostsManageSearchParams } from "@/components/dashboard/PostsManageView";
import RequestPublishButton, { type RequestStatus } from "@/components/dashboard/RequestPublishButton";
import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import type { PublicProfile } from "@/libs/profile";

interface DashboardPostsPageProps {
    searchParams: Promise<PostsManageSearchParams>;
}

// A reader whose approval is older than the session's role recheck was demoted since, and may ask again.
function currentRequestStatus(request: { status: RequestStatus; reviewedAt: Date | null } | null): RequestStatus | null {
    if (!request) return null;
    if (request.status === "Approved" && Date.now() - (request.reviewedAt?.getTime() ?? 0) > 5 * 60_000) return null;
    return request.status;
}

export default async function DashboardPostsPage({ searchParams }: DashboardPostsPageProps) {
    // proxy.ts (isGatedPath) redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const resolvedSearchParams = await searchParams;
    const isAuthor = hasRole(session.user.role, ROLES.AUTHOR);
    const lastRequest = isAuthor
        ? null
        : await PublishRequest.findOne({ userId: session.user.id }).sort({ createdAt: -1 }).select("status reviewedAt").lean<{ status: RequestStatus; reviewedAt: Date | null }>();
    const requestStatus = currentRequestStatus(lastRequest);
    const profile = isAuthor ? null : (await User.findById(session.user.id).select("profile").lean<{ profile?: PublicProfile }>())?.profile ?? {};

    return (
        <PostsManageView
            basePath="/dashboard/posts"
            heading="Manage Posts"
            scopeUserId={session.user.id}
            searchParams={resolvedSearchParams}
            composeControl={
                isAuthor ? (
                    <Button asChild>
                        <Link href="/posts/add">Add Post</Link>
                    </Button>
                ) : (
                    <RequestPublishButton
                        initialStatus={requestStatus}
                        profile={{
                            headline: profile?.headline ?? "",
                            bio: profile?.bio ?? "",
                            website: profile?.website ?? "",
                            links: profile?.links ?? [],
                            expertise: profile?.expertise ?? [],
                            topics: profile?.topics ?? [],
                        }}
                    />
                )
            }
        />
    );
}
