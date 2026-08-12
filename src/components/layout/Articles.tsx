import dbConnect from "@/libs/db-connect";
import Post from "@/models/Post";
import Category from "@/models/Category";
import ArticleGrid from "@/components/posts/ArticleGrid";
import ArticleCard, { toArticleCardData } from "@/components/posts/ArticleCard";

const RECENT_ARTICLES_LIMIT = 6;

export default async function Articles() {
    await dbConnect();

    const posts = await Post.find({ approval: "Approved", published: true, visibility: true })
        .sort({ publishedAt: -1 })
        .limit(RECENT_ARTICLES_LIMIT)
        .populate({ path: "categoryId", model: Category, select: "title" })
        .select("slug title titleDescription bannerImage publishedAt categoryId")
        .lean();

    const articles = posts.map((post) =>
        toArticleCardData(post as unknown as Parameters<typeof toArticleCardData>[0])
    );

    if (articles.length === 0) return null;

    return (
        <div className="mx-auto max-w-5xl px-6 py-8">
            <h2 className="text-center font-heading text-4xl font-semibold tracking-tight text-foreground">
                Latest Articles
            </h2>
            <div className="mt-10">
                <ArticleGrid>
                    {articles.map((article) => (
                        <ArticleCard key={article.slug} article={article} />
                    ))}
                </ArticleGrid>
            </div>
        </div>
    );
}
