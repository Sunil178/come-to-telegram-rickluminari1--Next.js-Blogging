import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { SoftDeleteModel } from "mongoose-delete";
import User from "@/models/User";
import PostVote from "@/models/PostVote";
import Comment from "@/models/Comment";
import type { IComment } from "@/models/Comment";
import CommentVote from "@/models/CommentVote";
import { getSession } from "@/libs/api-guard";
import { renderPostContent } from "@/libs/render-post-html";
import { buildCommentTree, type FlatComment } from "@/libs/comment-tree";
import { Badge } from "@/components/ui/badge";
import BannerImage from "@/components/posts/BannerImage";
import ReadingProgress from "@/components/posts/ReadingProgress";
import TableOfContents from "@/components/posts/TableOfContents";
import ViewTracker from "@/components/posts/ViewTracker";
import VoteButtons from "@/components/votes/VoteButtons";
import { SITE_URL } from "@/libs/site-url";
import CommentSection from "@/components/comments/CommentSection";
import { getViewablePost } from "@/libs/post-page";
import { commentsEnabled } from "@/libs/runtime-config";
import { findRelatedPosts } from "@/libs/related-posts";
import type { Types } from "mongoose";

interface PostPageProps {
    params: Promise<{ slug: string }>;
}

function MetaItem({ label, value, href }: { label: string; value: string; href?: string }) {
    return (
        <div>
            <p className="font-mono text-[11px] tracking-widest text-teal uppercase">{label}</p>
            {href ? (
                <Link href={href} className="mt-1 block text-sm text-foreground hover:text-teal">
                    {value}
                </Link>
            ) : (
                <p className="mt-1 text-sm text-foreground">{value}</p>
            )}
        </div>
    );
}

const getMyPostVote = cache(async (postId: string, userId: string | undefined) => {
    if (!userId) return null;
    const vote = await PostVote.findOne({ userId, postId }).lean();
    return vote ? Boolean(vote.type) : null;
});

const SoftDeleteComment = Comment as unknown as SoftDeleteModel<IComment>;

const getComments = cache(async (postId: string, userId: string | undefined) => {
    const flat = await SoftDeleteComment.findWithDeleted({ postId })
        .populate({ path: "userId", model: User, select: "username" })
        .sort({ createdAt: 1 })
        .lean();

    let myVotes = new Map<string, boolean>();
    if (userId && flat.length > 0) {
        const votes = await CommentVote.find({ userId, commentId: { $in: flat.map((c) => c._id) } })
            .select("commentId type")
            .lean();
        myVotes = new Map(votes.map((v) => [v.commentId.toString(), Boolean(v.type)]));
    }

    return buildCommentTree(flat as unknown as FlatComment[], myVotes);
});

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
    const { slug } = await params;
    const post = await getViewablePost(slug);
    if (!post) return {};

    const description = post.summary || post.titleDescription || undefined;

    return {
        title: post.title,
        description,
        // Replaces the root layout's openGraph rather than merging with it.
        openGraph: {
            siteName: "Vedev.Guru",
            title: post.title,
            description,
            images: post.bannerImage ? [post.bannerImage] : undefined,
            type: "article",
            publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
        },
    };
}

export default async function PostPage({ params }: PostPageProps) {
    const { slug } = await params;
    const post = await getViewablePost(slug);
    if (!post) notFound();

    const session = await getSession();
    const myVote = await getMyPostVote(post._id.toString(), session?.user?.id);
    const showComments = commentsEnabled() && post.visibility;
    const [comments, related] = await Promise.all([
        showComments ? getComments(post._id.toString(), session?.user?.id) : [],
        // categoryId is populated above; relate by its id.
        findRelatedPosts({ _id: post._id, tags: post.tags, categoryId: (post.categoryId as unknown as { _id?: Types.ObjectId } | null)?._id ?? null }),
    ]);

    const { html, toc, readingTime } = renderPostContent(post.content || "");

    const author = post.userId as unknown as { _id?: Types.ObjectId; username?: string } | null;
    const category = post.categoryId as unknown as { title?: string; slug?: string; visibility?: boolean } | null;
    const authorLabel = author?.username;
    const dateLabel = post.publishedAt
        ? new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : undefined;

    return (
        <article className="pb-24">
            <ReadingProgress />
            <ViewTracker slug={post.slug} />

            {!post.visibility && (
                <p role="status" className="mx-auto mt-6 max-w-3xl rounded-md border border-border bg-muted px-4 py-2 text-center text-sm text-muted-foreground">
                    Private post: only you can see it. Moderators and admins can&apos;t open it, and it never appears in lists, search or feeds.
                </p>
            )}
            <div className="mx-auto max-w-3xl px-6 pt-16 text-center">
                {category?.title &&
                    // Only a listed category filters the posts page; any other shows as a plain label.
                    (category.slug && category.visibility ? (
                        <Link href={`/posts?category=${encodeURIComponent(category.slug)}`} className="font-mono text-xs tracking-[0.3em] text-teal uppercase hover:underline">
                            {category.title}
                        </Link>
                    ) : (
                        <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">{category.title}</p>
                    ))}
                <h1 className="mt-4 font-heading text-5xl font-semibold tracking-tight text-foreground">
                    {post.title}
                </h1>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground lg:hidden">
                    {authorLabel && (
                        <Link href={`/users/${encodeURIComponent(authorLabel)}`} className="hover:text-teal">
                            {authorLabel}
                        </Link>
                    )}
                    {dateLabel && (
                        <>
                            <span aria-hidden>·</span>
                            <span>{dateLabel}</span>
                        </>
                    )}
                    <span aria-hidden>·</span>
                    <span>{readingTime} min read</span>
                </div>
                <div className="mt-6 flex justify-center">
                    <VoteButtons
                        voteUrl={`/api/posts/${post.slug}/vote`}
                        initialState={{ upvoteCount: post.upvoteCount ?? 0, downvoteCount: post.downvoteCount ?? 0, myVote }}
                        isLoggedIn={Boolean(session?.user)}
                    />
                </div>
            </div>

            {post.bannerImage && (
                <div className="mx-auto mt-10 max-w-4xl px-6">
                    <BannerImage
                        src={post.bannerImage}
                        priority
                        sizes="(max-width: 1024px) 100vw, 900px"
                        className="rounded-md"
                        unoptimized={!post.visibility}
                    />
                </div>
            )}

            <div className="mx-auto mt-14 max-w-6xl px-6 lg:grid lg:grid-cols-[160px_1fr_200px] lg:gap-10">
                <aside className="hidden lg:block">
                    <div className="sticky top-24 space-y-6">
                        {category?.title && <MetaItem label="Category" value={category.title} />}
                        {dateLabel && <MetaItem label="Published" value={dateLabel} />}
                        <MetaItem label="Reading time" value={`${readingTime} min`} />
                        {authorLabel && (
                            <MetaItem label="Written by" value={authorLabel} href={`/users/${encodeURIComponent(authorLabel)}`} />
                        )}
                    </div>
                </aside>

                {/* max-w-none drops prose's 65ch cap; the child rule below reapplies it to everything
                    except tables/code/images. prose-pre: strips typography's own always-dark <pre>
                    styling so our theme-aware bg-muted wrapper + hljs colors show through instead. */}
                <div
                    className="prose prose-neutral dark:prose-invert min-w-0 max-w-none prose-pre:bg-transparent prose-pre:text-foreground [&>*:not(:has(table)):not(:has(pre)):not(:has(figure))]:max-w-[65ch] [&_h1]:font-heading [&_h2]:font-heading [&_h3]:font-heading [&_h4]:font-heading"
                    dangerouslySetInnerHTML={{ __html: html }}
                />

                <aside className="hidden lg:block">
                    <TableOfContents toc={toc} />
                </aside>
            </div>

            {post.tags?.length > 0 && (
                <div className="mx-auto mt-10 flex max-w-6xl flex-wrap gap-2 px-6">
                    {post.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline" className="font-mono text-[11px] tracking-wide uppercase">
                            {tag}
                        </Badge>
                    ))}
                </div>
            )}

            {post.visibility && session?.user?.id !== author?._id?.toString() && (
                <p className="mx-auto mt-8 max-w-6xl px-6 text-xs text-muted-foreground">
                    Something wrong with this post?{" "}
                    <Link href={`/contact?topic=report&url=${encodeURIComponent(`${SITE_URL}/posts/${post.slug}`)}`} className="text-primary hover:underline">
                        Report it
                    </Link>
                </p>
            )}

            {related.length > 0 && (
                <section aria-labelledby="related-heading" className="mx-auto mt-12 max-w-6xl px-6">
                    <h2 id="related-heading" className="font-heading text-xl font-semibold text-foreground">Related posts</h2>
                    <ul className="mt-4 grid gap-4 sm:grid-cols-3">
                        {related.map((item) => (
                            <li key={item.slug} className="rounded-lg border border-border bg-card p-4 hover:bg-accent">
                                <Link href={`/posts/${item.slug}`} className="block">
                                    <span className="font-heading text-base font-semibold text-foreground">{item.title}</span>
                                    {item.titleDescription && (
                                        <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{item.titleDescription}</span>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {showComments && (
                <CommentSection
                    postSlug={post.slug}
                    initialComments={comments}
                    isLoggedIn={Boolean(session?.user)}
                    currentUserId={session?.user?.id ?? null}
                    currentUsername={session?.user?.username ?? null}
                />
            )}
        </article>
    );
}
