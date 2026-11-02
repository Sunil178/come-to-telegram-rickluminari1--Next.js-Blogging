import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getProfileUser } from "@/libs/profile-page";

// Checked here, outside this segment's loading.tsx, so a missing author answers 404 before the skeleton streams.
// Link prefetches skip it: nobody reads their status, and every card scrolled into view would cost a query.
export default async function ProfileLayout({ children, params }: { children: React.ReactNode; params: Promise<{ username: string }> }) {
    const prefetch = (await headers()).has("next-router-prefetch");
    if (!prefetch && !(await getProfileUser((await params).username))) notFound();
    return children;
}
