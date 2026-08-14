import dbConnect from "@/libs/db-connect";
import Post from "@/models/Post";
import Category from "@/models/Category";
import PostVote from "@/models/PostVote";
import { getSession } from "@/libs/api-guard";
import ArticleGrid from "@/components/posts/ArticleGrid";
import ArticleCard, { toArticleCardData } from "@/components/posts/ArticleCard";

const RECENT_ARTICLES_LIMIT = 6;

export default async function Articles() {
    await dbConnect();

    const posts = await Post.find({ approval: "Approved", published: true, visibility: true })
        .sort({ publishedAt: -1 })
        .limit(RECENT_ARTICLES_LIMIT)
        .populate({ path: "categoryId", model: Category, select: "title" })
        .select("slug title titleDescription bannerImage publishedAt categoryId upvoteCount downvoteCount")
        .lean();

    const session = await getSession();
    const userId = session?.user?.id;
    const isLoggedIn = Boolean(userId);
    const myVotes = isLoggedIn
        ? await PostVote.find({ userId, postId: { $in: posts.map((p) => p._id) } })
              .select("postId type")
              .lean()
        : [];
    const voteByPostId = new Map(myVotes.map((v) => [v.postId.toString(), Boolean(v.type)]));

    const articles = posts.map((post) => ({
        ...toArticleCardData(post as unknown as Parameters<typeof toArticleCardData>[0]),
        myVote: voteByPostId.get(post._id.toString()) ?? null,
    }));

    if (articles.length === 0) return null;

    return (
        <div className="mx-auto max-w-5xl px-6 py-8">
            <h2 className="text-center font-heading text-4xl font-semibold tracking-tight text-foreground">
                Latest Articles
            </h2>
            <div className="mt-10">
                <ArticleGrid>
                    {articles.map((article) => (
                        <ArticleCard key={article.slug} article={article} isLoggedIn={isLoggedIn} myVote={article.myVote} />
                    ))}
                </ArticleGrid>
            </div>
        </div>
    );
}
