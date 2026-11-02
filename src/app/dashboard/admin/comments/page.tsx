import Link from "next/link";
import Comment from "@/models/Comment";
import User from "@/models/User";
import Post from "@/models/Post";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RemoveCommentButton from "@/components/dashboard/admin/RemoveCommentButton";
import PostsSearch from "@/components/posts/PostsSearch";
import PostsPagination from "@/components/posts/PostsPagination";
import { escapeRegExp } from "@/libs/search-query";
import { buildSearchParamsHref } from "@/libs/build-href";
import { firstParam, parsePageParam, type SearchParamValue } from "@/libs/search-params";

const PAGE_SIZE = 20;

interface AdminCommentsPageProps {
    searchParams: Promise<{ page?: SearchParamValue; q?: SearchParamValue }>;
}

export default async function AdminCommentsPage({ searchParams }: AdminCommentsPageProps) {
    const params = await searchParams;
    const q = firstParam(params.q);
    const page = parsePageParam(params.page);
    const filter = q ? { content: { $regex: escapeRegExp(q), $options: "i" } } : {};
    const [total, comments] = await Promise.all([
        Comment.countDocuments(filter),
        Comment.find(filter)
            .populate({ path: "userId", model: User, select: "email username" })
            .populate({ path: "postId", model: Post, select: "title slug" })
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .lean(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const buildHref = ({ page: next }: { page: number }) => buildSearchParamsHref("/dashboard/admin/comments", { q, page: next > 1 ? next : undefined });

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Comment Moderation</h1>
            <p className="mt-2 text-muted-foreground">Every comment, newest first.</p>
            <div className="mt-6">
                <PostsSearch label="Search comments" placeholder="Search comments..." />
            </div>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Comment</TableHead>
                            <TableHead>Author</TableHead>
                            <TableHead>Post</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {comments.map((comment) => {
                            const author = comment.userId as unknown as { email?: string; username?: string } | null;
                            const post = comment.postId as unknown as { title?: string; slug?: string } | null;
                            return (
                                <TableRow key={String(comment._id)}>
                                    <TableCell className="max-w-md truncate">{comment.content}</TableCell>
                                    <TableCell>{author?.email || author?.username || "—"}</TableCell>
                                    <TableCell>
                                        {post?.slug ? (
                                            <Link href={`/posts/${post.slug}`} className="text-primary hover:underline">
                                                {post.title}
                                            </Link>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <RemoveCommentButton id={String(comment._id)} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {comments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    {q ? "No comments match." : "No comments yet."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <PostsPagination page={page} totalPages={totalPages} buildHref={buildHref} className="mt-8" />
        </div>
    );
}
