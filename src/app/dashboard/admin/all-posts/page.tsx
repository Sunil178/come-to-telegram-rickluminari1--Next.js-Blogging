import PostsManageView, { type PostsManageSearchParams } from "@/components/dashboard/PostsManageView";

interface AllPostsPageProps {
    searchParams: Promise<PostsManageSearchParams>;
}

export default async function AllPostsPage({ searchParams }: AllPostsPageProps) {
    // proxy.ts's matcher redirects unauthenticated/under-privileged requests before this renders.
    const resolvedSearchParams = await searchParams;

    return (
        <PostsManageView
            basePath="/dashboard/admin/all-posts"
            heading="All Posts"
            description="Every author's posts across the site, regardless of approval or publish state."
            searchParams={resolvedSearchParams}
        />
    );
}
