import type { Metadata } from "next";
import { notFound } from "next/navigation";
import User from "@/models/User";
import Post from "@/models/Post";
import Category from "@/models/Category";
import UserVote from "@/models/UserVote";
import { getSession } from "@/libs/api-guard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ArticleGrid from "@/components/posts/ArticleGrid";
import ArticleCard, { toArticleCardData } from "@/components/posts/ArticleCard";
import VoteButtons from "@/components/votes/VoteButtons";

interface ProfilePageProps {
    params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
    const { username } = await params;
    const user = await User.findOne({ username: decodeURIComponent(username) }).select("username").lean();
    if (!user) return {};
    return { title: `${user.username} — Vedev.Guru` };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { username: rawUsername } = await params;
    const username = decodeURIComponent(rawUsername);

    const profileUser = await User.findOne({ username })
        .select("username avatar intro profile upvoteCount downvoteCount")
        .lean();
    if (!profileUser) notFound();

    const session = await getSession();
    const isOwnProfile = session?.user?.id === profileUser._id.toString();

    const myVote =
        !isOwnProfile && session?.user?.id
            ? await UserVote.findOne({ userId: session.user.id, targetUserId: profileUser._id }).lean()
            : null;

    const posts = await Post.find({ userId: profileUser._id, approval: "Approved", published: true, visibility: true })
        .sort({ publishedAt: -1 })
        .populate({ path: "categoryId", model: Category, select: "title" })
        .select("slug title titleDescription bannerImage publishedAt categoryId upvoteCount downvoteCount")
        .lean();

    const articles = posts.map((post) => toArticleCardData(post as unknown as Parameters<typeof toArticleCardData>[0]));

    return (
        <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="flex flex-col items-center text-center">
                <Avatar size="lg">
                    <AvatarImage src={profileUser.avatar || undefined} alt={profileUser.username} />
                    <AvatarFallback className="text-2xl">{profileUser.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-foreground">
                    {profileUser.username}
                </h1>
                {profileUser.intro && <p className="mt-2 text-muted-foreground">{profileUser.intro}</p>}
                {profileUser.profile && <p className="mt-4 max-w-xl text-sm text-foreground">{profileUser.profile}</p>}

                {!isOwnProfile && (
                    <div className="mt-6">
                        <VoteButtons
                            voteUrl={`/api/users/${encodeURIComponent(profileUser.username)}/vote`}
                            initialState={{
                                upvoteCount: profileUser.upvoteCount ?? 0,
                                downvoteCount: profileUser.downvoteCount ?? 0,
                                myVote: myVote ? Boolean(myVote.type) : null,
                            }}
                            isLoggedIn={Boolean(session?.user)}
                        />
                    </div>
                )}
            </div>

            <div className="mt-14">
                <h2 className="font-heading text-2xl font-semibold text-foreground">Published posts</h2>
                <div className="mt-6">
                    {articles.length > 0 ? (
                        <ArticleGrid>
                            {articles.map((article) => (
                                <ArticleCard key={article.slug} article={article} isLoggedIn={Boolean(session?.user)} />
                            ))}
                        </ArticleGrid>
                    ) : (
                        <p className="text-sm text-muted-foreground">No published posts yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
