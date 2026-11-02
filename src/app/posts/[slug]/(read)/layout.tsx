import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getViewablePost } from "@/libs/post-page";

// Checked here, outside this segment's loading.tsx, so a missing post answers 404 before the skeleton streams.
// Link prefetches skip it: nobody reads their status, and every card scrolled into view would cost a query.
export default async function PostLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
    const prefetch = (await headers()).has("next-router-prefetch");
    if (!prefetch && !(await getViewablePost((await params).slug))) notFound();
    return children;
}
