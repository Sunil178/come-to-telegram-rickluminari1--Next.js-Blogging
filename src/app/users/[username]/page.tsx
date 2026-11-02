import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Post from "@/models/Post";
import Category from "@/models/Category";
import UserVote from "@/models/UserVote";
import { getSession } from "@/libs/api-guard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ArticleGrid from "@/components/posts/ArticleGrid";
import ArticleCard, { toArticleCardData } from "@/components/posts/ArticleCard";
import VoteButtons from "@/components/votes/VoteButtons";
import { Badge } from "@/components/ui/badge";
import { profileLinks, type PublicProfile } from "@/libs/profile";
import { publicPostFilter } from "@/libs/post-visibility";
import { getProfileUser } from "@/libs/profile-page";

interface ProfilePageProps {
    params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
    const user = await getProfileUser((await params).username);
    if (!user) return {};
    return { title: user.username };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
    const profileUser = await getProfileUser((await params).username);
    if (!profileUser) notFound();

    const session = await getSession();
    const isOwnProfile = session?.user?.id === profileUser._id.toString();

    const myVote =
        !isOwnProfile && session?.user?.id
            ? await UserVote.findOne({ userId: session.user.id, targetUserId: profileUser._id }).lean()
            : null;

    const posts = await Post.find({ userId: profileUser._id, ...publicPostFilter() })
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
                <ProfileDetails profile={profileUser.profile ?? {}} />

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

function hostOf(url: string): string {
    try {
        return new URL(url).host.replace(/^www\./, "");
    } catch {
        return url;
    }
}

function ProfileDetails({ profile }: { profile: PublicProfile }) {
    const place = [profile.city, profile.country].filter(Boolean).join(", ");
    const links = profileLinks(profile);
    const tags = [...(profile.expertise ?? []), ...(profile.topics ?? [])];
    return (
        <>
            {profile.headline && <p className="mt-2 text-muted-foreground">{profile.headline}</p>}
            {(place || profile.education) && (
                <p className="mt-2 text-sm text-muted-foreground">{[place, profile.education].filter(Boolean).join(" · ")}</p>
            )}
            {profile.bio && <p className="mt-4 max-w-xl text-sm whitespace-pre-wrap text-foreground">{profile.bio}</p>}
            {tags.length > 0 && (
                <ul className="mt-4 flex max-w-xl flex-wrap justify-center gap-2" aria-label="Expertise and topics">
                    {[...new Set(tags)].map((tag) => (
                        <li key={tag}>
                            <Badge variant="secondary">{tag}</Badge>
                        </li>
                    ))}
                </ul>
            )}
            {links.length > 0 && (
                <ul className="mt-4 flex flex-wrap justify-center gap-4 text-sm" aria-label="Links">
                    {links.map((link) => (
                        <li key={link}>
                            {/* ugc + nofollow: user-supplied links shouldn't pass the site's reputation. */}
                            <a href={link} rel="ugc nofollow noopener noreferrer" target="_blank" className="text-primary hover:underline">
                                {hostOf(link)}
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
