import Link from "next/link";
import { redirect } from "next/navigation";
import { FilterQuery } from "mongoose";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCircle2, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import dbConnect from "@/libs/db-connect";
import Post, { IPost } from "@/models/Post";
import User from "@/models/User";
import Category from "@/models/Category";
import { getSession } from "@/libs/api-guard";
import { escapeRegExp } from "@/libs/search-query";
import { buildSearchParamsHref } from "@/libs/build-href";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PostsSearch from "@/components/posts/PostsSearch";
import PostsPagination from "@/components/posts/PostsPagination";

const PAGE_SIZE = 10;

const SORTABLE_FIELDS = ["title", "publishedAt", "visitorCount", "commentCount", "createdAt"] as const;
type SortField = (typeof SORTABLE_FIELDS)[number];

const APPROVAL_OPTIONS = ["Pending", "Approved", "Rejected", "Inactive"] as const;

const APPROVAL_STYLES: Record<string, string> = {
    Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Rejected: "bg-destructive/10 text-destructive",
    Inactive: "bg-muted text-muted-foreground",
};

function SortIcon({ field, sortField, sortOrder }: { field: SortField; sortField: SortField; sortOrder: number }) {
    if (sortField !== field) return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
    return sortOrder === 1 ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
}

function SortableHead({
    field,
    label,
    href,
    sortField,
    sortOrder,
}: {
    field: SortField;
    label: string;
    href: string;
    sortField: SortField;
    sortOrder: number;
}) {
    return (
        <TableHead>
            <Link href={href} className="flex items-center gap-1 hover:text-foreground">
                {label}
                <SortIcon field={field} sortField={sortField} sortOrder={sortOrder} />
            </Link>
        </TableHead>
    );
}

interface DashboardPostsPageProps {
    searchParams: Promise<{
        page?: string;
        q?: string;
        sort?: string;
        order?: string;
        approval?: string;
        published?: string;
    }>;
}

export default async function DashboardPostsPage({ searchParams }: DashboardPostsPageProps) {
    const session = await getSession();
    if (!session?.user) redirect("/auth/login?callbackUrl=/dashboard/posts");

    const { page: pageParam, q, sort, order, approval, published } = await searchParams;
    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const sortField: SortField = SORTABLE_FIELDS.includes(sort as SortField) ? (sort as SortField) : "createdAt";
    const sortOrder = order === "asc" ? 1 : -1;

    await dbConnect();

    const filter: FilterQuery<IPost> = {};
    if (q) filter.title = { $regex: escapeRegExp(q), $options: "i" };
    if (approval && APPROVAL_OPTIONS.includes(approval as (typeof APPROVAL_OPTIONS)[number])) filter.approval = approval;
    if (published === "true" || published === "false") filter.published = published === "true";

    const [total, posts] = await Promise.all([
        Post.countDocuments(filter),
        Post.find(filter)
            .populate({ path: "userId", model: User, select: "email username" })
            .populate({ path: "categoryId", model: Category, select: "title" })
            .sort({ [sortField]: sortOrder })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .lean(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const buildHref = (overrides: Record<string, string | number | undefined>) =>
        buildSearchParamsHref("/dashboard/posts", { q, sort, order, approval, published, page: String(page), ...overrides });

    const sortHref = (field: SortField) => {
        const nextOrder = sortField === field && sortOrder === 1 ? "desc" : "asc";
        return buildHref({ sort: field, order: nextOrder, page: undefined });
    };

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Manage Posts</h1>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PostsSearch defaultValue={q || ""} />
                <Button asChild>
                    <Link href="/posts/add">Add Post</Link>
                </Button>
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
                <FilterGroup label="Approval" paramKey="approval" active={approval} options={APPROVAL_OPTIONS} buildHref={buildHref} />
                <FilterGroup label="Published" paramKey="published" active={published} options={["true", "false"]} labels={{ true: "Yes", false: "No" }} buildHref={buildHref} />
            </div>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Author</TableHead>
                            <TableHead>Approval</TableHead>
                            <TableHead>Published</TableHead>
                            <SortableHead field="publishedAt" label="Published At" href={sortHref("publishedAt")} sortField={sortField} sortOrder={sortOrder} />
                            <SortableHead field="visitorCount" label="Visitors" href={sortHref("visitorCount")} sortField={sortField} sortOrder={sortOrder} />
                            <TableHead>Votes</TableHead>
                            <SortableHead field="commentCount" label="Comments" href={sortHref("commentCount")} sortField={sortField} sortOrder={sortOrder} />
                            <SortableHead field="createdAt" label="Created At" href={sortHref("createdAt")} sortField={sortField} sortOrder={sortOrder} />
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
                                    <TableCell>
                                        {post.published ? (
                                            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                                        ) : (
                                            <XCircle className="size-4 text-muted-foreground" />
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("en-US") : "—"}
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{post.visitorCount ?? 0}</TableCell>
                                    <TableCell>
                                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <ThumbsUp className="size-3.5" /> {post.upvoteCount ?? 0}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <ThumbsDown className="size-3.5" /> {post.downvoteCount ?? 0}
                                            </span>
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{post.commentCount ?? 0}</TableCell>
                                    <TableCell className="font-mono text-xs">
                                        {new Date(post.createdAt).toLocaleDateString("en-US")}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {posts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                                    No posts found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <PostsPagination page={page} totalPages={totalPages} buildHref={buildHref} className="mt-6" />
        </div>
    );
}

function FilterGroup({
    label,
    paramKey,
    active,
    options,
    labels,
    buildHref,
}: {
    label: string;
    paramKey: string;
    active?: string;
    options: readonly string[];
    labels?: Record<string, string>;
    buildHref: (overrides: Record<string, string | number | undefined>) => string;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-widest uppercase">
            <span className="text-muted-foreground">{label}:</span>
            <Link href={buildHref({ [paramKey]: undefined, page: undefined })}>
                <Badge variant={!active ? "default" : "secondary"} className={active ? "bg-teal/10 text-teal hover:bg-teal/20" : ""}>
                    All
                </Badge>
            </Link>
            {options.map((option) => (
                <Link key={option} href={buildHref({ [paramKey]: option, page: undefined })}>
                    <Badge
                        variant={active === option ? "default" : "secondary"}
                        className={active === option ? "" : "bg-teal/10 text-teal hover:bg-teal/20"}
                    >
                        {labels?.[option] || option}
                    </Badge>
                </Link>
            ))}
        </div>
    );
}
