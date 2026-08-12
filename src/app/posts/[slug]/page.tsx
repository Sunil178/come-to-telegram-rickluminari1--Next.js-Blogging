import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import dbConnect from "@/libs/db-connect";
import Post from "@/models/Post";
import User from "@/models/User";
import Category from "@/models/Category";
import { getSession } from "@/libs/api-guard";
import { processPostContent } from "@/libs/post-content";
import { Badge } from "@/components/ui/badge";
import BannerImage from "@/components/posts/BannerImage";
import ReadingProgress from "@/components/posts/ReadingProgress";
import TableOfContents from "@/components/posts/TableOfContents";

interface PostPageProps {
    params: Promise<{ slug: string }>;
}

function MetaItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="font-mono text-[11px] tracking-widest text-gold uppercase">{label}</p>
            <p className="mt-1 text-sm text-foreground">{value}</p>
        </div>
    );
}

const getPost = cache(async (slug: string) => {
    await dbConnect();
    const post = await Post.findOne({ slug })
        .populate({ path: "userId", model: User, select: "username" })
        .populate({ path: "categoryId", model: Category, select: "title slug" })
        .lean();
    if (!post) return null;

    const isPubliclyVisible = post.approval === "Approved" && post.published && post.visibility;
    if (isPubliclyVisible) return post;

    const owner = post.userId as unknown as { _id?: { toString(): string } } | null;
    const session = await getSession();
    if (session?.user?.id && owner?._id && owner._id.toString() === session.user.id) {
        return post;
    }

    return null;
});

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
    const { slug } = await params;
    const post = await getPost(slug);
    if (!post) return {};

    const description = post.summary || post.titleDescription || undefined;

    return {
        title: `${post.title} — Vedev.Guru`,
        description,
        openGraph: {
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
    const post = await getPost(slug);
    if (!post) notFound();

    const window = new JSDOM("").window;
    const purify = DOMPurify(window as unknown as Window & typeof globalThis);
    const sanitized = purify.sanitize(post.content || "");
    const { html, toc, readingTime } = processPostContent(window.document, sanitized);

    const author = post.userId as unknown as { username?: string } | null;
    const category = post.categoryId as unknown as { title?: string } | null;
    const authorLabel = author?.username;
    const dateLabel = post.publishedAt
        ? new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : undefined;

    return (
        <article className="pb-24">
            <ReadingProgress />

            <div className="mx-auto max-w-3xl px-6 pt-16 text-center">
                {category?.title && (
                    <p className="font-mono text-xs tracking-[0.3em] text-gold uppercase">{category.title}</p>
                )}
                <h1 className="mt-4 font-heading text-5xl font-semibold tracking-tight text-foreground">
                    {post.title}
                </h1>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground lg:hidden">
                    {authorLabel && <span>{authorLabel}</span>}
                    {dateLabel && (
                        <>
                            <span aria-hidden>·</span>
                            <span>{dateLabel}</span>
                        </>
                    )}
                    <span aria-hidden>·</span>
                    <span>{readingTime} min read</span>
                </div>
            </div>

            {post.bannerImage && (
                <div className="mx-auto mt-10 max-w-4xl px-6">
                    <BannerImage
                        src={post.bannerImage}
                        priority
                        sizes="(max-width: 1024px) 100vw, 900px"
                        className="rounded-md"
                    />
                </div>
            )}

            <div className="mx-auto mt-14 max-w-5xl px-6 lg:grid lg:grid-cols-[160px_1fr_200px] lg:gap-10">
                <aside className="hidden lg:block">
                    <div className="sticky top-24 space-y-6">
                        {category?.title && <MetaItem label="Category" value={category.title} />}
                        {dateLabel && <MetaItem label="Published" value={dateLabel} />}
                        <MetaItem label="Reading time" value={`${readingTime} min`} />
                        {authorLabel && <MetaItem label="Written by" value={authorLabel} />}
                    </div>
                </aside>

                <div
                    className="prose prose-neutral dark:prose-invert min-w-0 [&_h1]:font-heading [&_h2]:font-heading [&_h3]:font-heading [&_h4]:font-heading"
                    dangerouslySetInnerHTML={{ __html: html }}
                />

                <aside className="hidden lg:block">
                    <TableOfContents toc={toc} />
                </aside>
            </div>

            {post.tags?.length > 0 && (
                <div className="mx-auto mt-10 flex max-w-5xl flex-wrap gap-2 px-6">
                    {post.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline" className="font-mono text-[11px] tracking-wide uppercase">
                            {tag}
                        </Badge>
                    ))}
                </div>
            )}
        </article>
    );
}
