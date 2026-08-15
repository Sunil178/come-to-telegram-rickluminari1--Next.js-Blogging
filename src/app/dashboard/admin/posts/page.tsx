import Link from "next/link";
import { FilterQuery } from "mongoose";
import Post, { IPost, ApprovalStatus } from "@/models/Post";
import User from "@/models/User";
import Category from "@/models/Category";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PostApprovalActions from "@/components/dashboard/admin/PostApprovalActions";

const PAGE_SIZE = 10;
const APPROVAL_OPTIONS = Object.values(ApprovalStatus);

const APPROVAL_STYLES: Record<string, string> = {
    Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Rejected: "bg-destructive/10 text-destructive",
    Inactive: "bg-muted text-muted-foreground",
};

interface AdminPostsPageProps {
    searchParams: Promise<{ approval?: string }>;
}

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
    // proxy.ts's matcher redirects unauthenticated/under-privileged requests before this renders.
    const { approval: approvalParam } = await searchParams;
    const approval = APPROVAL_OPTIONS.includes(approvalParam as ApprovalStatus) ? (approvalParam as ApprovalStatus) : ApprovalStatus.Pending;

    const filter: FilterQuery<IPost> = { approval };

    const posts = await Post.find(filter)
        .populate({ path: "userId", model: User, select: "email username" })
        .populate({ path: "categoryId", model: Category, select: "title" })
        .sort({ createdAt: -1 })
        .limit(PAGE_SIZE)
        .lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Review Queue</h1>
            <p className="mt-2 text-muted-foreground">Posts from every author, filtered by approval status.</p>

            <div className="mt-4 flex flex-wrap gap-2">
                {APPROVAL_OPTIONS.map((option) => (
                    <Link key={option} href={`/dashboard/admin/posts?approval=${option}`}>
                        <Badge variant={option === approval ? "default" : "outline"} className="cursor-pointer">
                            {option}
                        </Badge>
                    </Link>
                ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Author</TableHead>
                            <TableHead>Approval</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {posts.map((post) => {
                            const author = post.userId as unknown as { email?: string; username?: string } | null;
                            const category = post.categoryId as unknown as { title?: string } | null;
                            return (
                                <TableRow key={String(post._id)}>
                                    <TableCell className="font-medium">
                                        <Link href={`/posts/${post.slug}`} className="text-primary hover:underline">
                                            {post.title || "—"}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{category?.title || "—"}</TableCell>
                                    <TableCell>{author?.email || author?.username || "—"}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={APPROVAL_STYLES[post.approval] || ""}>
                                            {post.approval}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <PostApprovalActions slug={post.slug} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {posts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    No {approval.toLowerCase()} posts.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
