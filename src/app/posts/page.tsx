import Link from "next/link";
import { FilterQuery } from "mongoose";
import dbConnect from "@/libs/db-connect";
import Post, { IPost } from "@/models/Post";
import Category from "@/models/Category";
import { Badge } from "@/components/ui/badge";
import ArticleGrid from "@/components/posts/ArticleGrid";
import PostsSearch from "@/components/posts/PostsSearch";
import PostsPagination from "@/components/posts/PostsPagination";
import ArticleCard, { toArticleCardData } from "@/components/posts/ArticleCard";
import { escapeRegExp } from "@/libs/search-query";
import { buildSearchParamsHref } from "@/libs/build-href";

const PAGE_SIZE = 9;

interface PostsPageProps {
    searchParams: Promise<{ page?: string; category?: string; q?: string }>;
}

export const metadata = {
    title: "Posts — Vedev.Guru",
    description: "Essays and deep dives on technology, culture, and the questions in between.",
};

export default async function PostsPage({ searchParams }: PostsPageProps) {
    const { page: pageParam, category: categorySlug, q } = await searchParams;
    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);

    await dbConnect();

    const categories = await Category.find({ visibility: true }).select("title slug").sort({ title: 1 }).lean();

    const filter: FilterQuery<IPost> = { approval: "Approved", published: true, visibility: true };

    if (categorySlug) {
        const activeCategory = categories.find((c) => c.slug === categorySlug);
        if (activeCategory) filter.categoryId = activeCategory._id;
    }

    if (q) {
        filter.title = { $regex: escapeRegExp(q), $options: "i" };
    }

    const [total, posts] = await Promise.all([
        Post.countDocuments(filter),
        Post.find(filter)
            .sort({ publishedAt: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .populate({ path: "categoryId", model: Category, select: "title" })
            .select("slug title titleDescription bannerImage publishedAt categoryId")
            .lean(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const articles = posts.map((post) => toArticleCardData(post as unknown as Parameters<typeof toArticleCardData>[0]));

    const buildHref = (overrides: { page?: number; category?: string }) => {
        const nextCategory = overrides.category !== undefined ? overrides.category : categorySlug;
        const nextPage = overrides.page && overrides.page > 1 ? overrides.page : undefined;
        return buildSearchParamsHref("/posts", { q, category: nextCategory, page: nextPage });
    };

    return (
        <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-center">
                <h1 className="font-heading text-5xl font-semibold tracking-tight text-foreground">All Posts</h1>
                <p className="mt-3 text-muted-foreground">
                    {total} article{total === 1 ? "" : "s"} on technology, culture, and everything in between.
                </p>
            </div>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap justify-center gap-2 font-mono text-[11px] tracking-widest uppercase">
                    <Link href={buildHref({ category: "" })}>
                        <Badge
                            variant={!categorySlug ? "default" : "secondary"}
                            className={!categorySlug ? "" : "bg-gold/10 text-gold hover:bg-gold/20"}
                        >
                            All
                        </Badge>
                    </Link>
                    {categories.map((c) => (
                        <Link key={c.slug} href={buildHref({ category: c.slug })}>
                            <Badge
                                variant={categorySlug === c.slug ? "default" : "secondary"}
                                className={categorySlug === c.slug ? "" : "bg-gold/10 text-gold hover:bg-gold/20"}
                            >
                                {c.title}
                            </Badge>
                        </Link>
                    ))}
                </div>
                <PostsSearch defaultValue={q || ""} />
            </div>

            <div className="mt-10">
                {articles.length > 0 ? (
                    <ArticleGrid>
                        {articles.map((article) => (
                            <ArticleCard key={article.slug} article={article} />
                        ))}
                    </ArticleGrid>
                ) : (
                    <p className="py-16 text-center text-muted-foreground">No articles found.</p>
                )}
            </div>

            <PostsPagination
                page={page}
                totalPages={totalPages}
                buildHref={buildHref}
                className="mt-12"
                labelClassName="font-mono text-xs tracking-wide"
            />
        </div>
    );
}
