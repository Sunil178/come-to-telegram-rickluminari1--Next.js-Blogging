import { hashSync } from "bcrypt";
import type { HydratedDocument, Types } from "mongoose";
import dbConnect from "@/libs/db-connect";
import Post, { type IPost } from "@/models/Post";
import User, { type IUser } from "@/models/User";
import Category from "@/models/Category";
import Comment from "@/models/Comment";
import PostVote from "@/models/PostVote";
import CommentVote from "@/models/CommentVote";
import UserVote from "@/models/UserVote";
import { toggleVote, type VoteResult } from "@/libs/toggle-vote";
import { downloadSeedImage } from "@/libs/download-seed-image";
import { loadSeedPosts } from "@/libs/load-seed-posts";
import { markdownToPostHtml } from "@/libs/markdown-to-post-html";
import categoriesData from "./categories.json";
import usersData from "./users.json";
import commentTemplates from "./comment-templates.json";

// Old posts.json fixtures, retired now that src/seeds/posts/*.md replaces them.
// Matched on slug+title, not slug alone: some slugs (e.g. "5g-and-beyond") are generic
// enough that a real post could collide, and this cleanup hard-deletes past soft-delete.
const LEGACY_POSTS = [
    { slug: "future-of-ai", title: "The Future of AI" },
    { slug: "blockchain-next-payment-methods", title: "The Blockchain Dominance" },
    { slug: "james-webb-discoveries", title: "James Webb's Latest Discoveries" },
    { slug: "covid-19-long-term-effects", title: "Understanding Long COVID" },
    { slug: "climate-change-opinions", title: "Climate Change: Voices Around the World" },
    { slug: "ai-in-healthcare", title: "How AI is Saving Lives" },
    { slug: "mars-colonization", title: "Mars Colonization by 2050?" },
    { slug: "indian-election-2025", title: "Indian General Election 2025" },
    { slug: "digital-nomad-lifestyle", title: "Rise of Digital Nomads" },
    { slug: "quantum-computing-explained", title: "Quantum Computing Explained" },
    { slug: "mental-health-awareness", title: "Breaking the Mental Health Stigma" },
    { slug: "climate-science-data", title: "Latest Climate Science Reports" },
    { slug: "5g-and-beyond", title: "5G and Beyond" },
    { slug: "women-in-tech", title: "Women in Tech: Breaking Barriers" },
    { slug: "vaccines-and-future", title: "Future of Vaccines" },
    { slug: "global-warming-politics", title: "Politics of Global Warming" },
    { slug: "top-travel-destinations-2025", title: "Top Travel Destinations in 2025" },
    { slug: "ai-vs-human-creativity", title: "AI vs Human Creativity" },
];

// Demo users are seeded with this password so they can be logged into for manual testing.
const DEMO_PASSWORD = "Passw0rd!";

type UserDoc = HydratedDocument<IUser>;
type PostDoc = HydratedDocument<IPost>;

async function seedCategories(): Promise<Record<string, Types.ObjectId>> {
    const categories: Record<string, Types.ObjectId> = {};
    for (const cat of categoriesData) {
        let category = await Category.findOne({ slug: cat.slug });
        if (!category) {
            category = await Category.create({ visibility: true, ...cat });
            console.log(`📂 Category created: ${cat.title}`);
        } else {
            console.log(`📂 Category exists: ${cat.title}`);
        }
        categories[cat.slug] = category._id;
    }
    return categories;
}

async function seedDemoUsers(): Promise<UserDoc[]> {
    const users: UserDoc[] = [];
    for (const raw of usersData) {
        let user = await User.findOne({ $or: [{ username: raw.username }, { email: raw.email }] });
        if (!user) {
            user = await User.create({ ...raw, password: hashSync(DEMO_PASSWORD, 10) });
            console.log(`👤 Demo user created: ${raw.username}`);
        } else {
            console.log(`👤 Demo user exists: ${raw.username}`);
        }
        users.push(user);
    }
    return users;
}

// Hard-deletes (via .collection, bypassing mongoose-delete) the retired fixtures and
// everything referencing them, so they don't linger in trash views.
async function retireLegacyPosts(): Promise<void> {
    const legacyPosts = await Post.collection
        .find({ $or: LEGACY_POSTS.map(({ slug, title }) => ({ slug, title })) }, { projection: { _id: 1 } })
        .toArray();
    if (legacyPosts.length === 0) return;
    const postIds = legacyPosts.map((p) => p._id);

    const legacyComments = await Comment.collection.find({ postId: { $in: postIds } }, { projection: { _id: 1 } }).toArray();
    const commentIds = legacyComments.map((c) => c._id);

    await CommentVote.collection.deleteMany({ commentId: { $in: commentIds } });
    await Comment.collection.deleteMany({ postId: { $in: postIds } });
    await PostVote.collection.deleteMany({ postId: { $in: postIds } });
    await Post.collection.deleteMany({ _id: { $in: postIds } });
    console.log(`🗑️  Retired ${legacyPosts.length} legacy demo post(s) and their engagement`);
}

async function seedOwnerPosts(ownerId: Types.ObjectId, categories: Record<string, Types.ObjectId>): Promise<PostDoc[]> {
    const posts: PostDoc[] = [];
    for (const raw of loadSeedPosts()) {
        const existing = await Post.findOne({ slug: raw.slug });
        if (existing) {
            if (existing.bannerImage?.startsWith("http")) {
                existing.bannerImage = await downloadSeedImage(existing.bannerImage, raw.slug);
                await existing.save();
            }
            console.log(`⚠️ Post already exists: ${raw.slug}`);
            posts.push(existing);
            continue;
        }

        const categoryId = categories[raw.categorySlug];
        if (!categoryId) {
            console.log(`❌ Category not found for slug: ${raw.categorySlug}, skipping...`);
            continue;
        }

        const { categorySlug: _categorySlug, bannerImage, markdownBody, ...rest } = raw;
        const localBannerImage = bannerImage?.startsWith("http") ? await downloadSeedImage(bannerImage, raw.slug) : bannerImage;
        const content = await markdownToPostHtml(markdownBody);
        const post = await Post.create({ ...rest, content, bannerImage: localBannerImage, userId: ownerId, categoryId });
        console.log(`📝 Post created: ${raw.title}`);
        posts.push(post);
    }
    return posts;
}

// Skips voters who already voted — toggleVote() would flip an existing vote off,
// which would make re-running the seeder destructive.
async function seedVoteIfMissing(options: Parameters<typeof toggleVote>[0]): Promise<VoteResult | null> {
    const existing = await options.voteModel.findOne(options.voteFilter);
    if (existing) return null;
    return toggleVote(options);
}

// Dedupes on (postId, userId, content) so re-running the seeder doesn't pile up duplicate comments.
async function seedCommentIfMissing(options: {
    postId: Types.ObjectId;
    author: UserDoc;
    content: string;
    parentId?: Types.ObjectId | null;
}) {
    const { postId, author, content, parentId = null } = options;
    const existing = await Comment.findOne({ postId, userId: author._id, content });
    if (existing) return existing;

    const comment = await Comment.create({ postId, userId: author._id, content, parentId });
    await Post.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });
    console.log(`💬 ${author.username} ${parentId ? "replied" : "commented"}`);
    return comment;
}

function isPubliclyVisible(post: PostDoc): boolean {
    return post.approval === "Approved" && post.published && post.visibility;
}

// Votes and threaded comments from demo users (never the post's own owner — the
// app's vote routes disallow that same shape of self-engagement).
async function seedEngagement(owner: UserDoc, demoUsers: UserDoc[], posts: PostDoc[]): Promise<void> {
    let templateIndex = 0;
    const nextComment = () => commentTemplates[templateIndex++ % commentTemplates.length];

    const voters = demoUsers.filter((u) => u._id.toString() !== owner._id.toString());

    for (const post of posts) {
        if (!isPubliclyVisible(post)) continue;

        for (const [i, voter] of voters.entries()) {
            const type = i % 5 !== 0; // one dissenting voter per post, the rest upvote
            const result = await seedVoteIfMissing({
                voteModel: PostVote,
                voteFilter: { userId: voter._id, postId: post._id },
                counterModel: Post,
                counterId: post._id,
                type,
                voterId: voter._id.toString(),
            });
            if (result) console.log(`👍 ${voter.username} voted on "${post.title}"`);
        }

        const rootComments = [];
        for (const author of voters.slice(0, 2)) {
            rootComments.push(await seedCommentIfMissing({ postId: post._id, author, content: nextComment() }));
        }

        const replyAuthor = voters[2] ?? owner;
        if (rootComments[0]) {
            rootComments.push(
                await seedCommentIfMissing({
                    postId: post._id,
                    author: replyAuthor,
                    parentId: rootComments[0]._id,
                    content: nextComment(),
                })
            );
        }

        for (const comment of rootComments) {
            const commentVoters = voters.filter((v) => v._id.toString() !== comment.userId.toString()).slice(0, 2);
            for (const [i, voter] of commentVoters.entries()) {
                const result = await seedVoteIfMissing({
                    voteModel: CommentVote,
                    voteFilter: { userId: voter._id, commentId: comment._id },
                    counterModel: Comment,
                    counterId: comment._id,
                    type: i === 0,
                    voterId: voter._id.toString(),
                });
                if (result) console.log(`👍 ${voter.username} voted on a comment`);
            }
        }
    }
}

// Every demo user upvotes the post owner's profile, plus a light round of
// cross-voting so UserVote isn't seeded one-directionally.
async function seedProfileVotes(owner: UserDoc, demoUsers: UserDoc[]): Promise<void> {
    for (const voter of demoUsers) {
        const result = await seedVoteIfMissing({
            voteModel: UserVote,
            voteFilter: { userId: voter._id, targetUserId: owner._id },
            counterModel: User,
            counterId: owner._id,
            type: true,
            voterId: voter._id.toString(),
        });
        if (result) console.log(`⭐ ${voter.username} upvoted ${owner.username}'s profile`);
    }

    for (let i = 0; i < demoUsers.length; i++) {
        const voter = demoUsers[i];
        const target = demoUsers[(i + 1) % demoUsers.length];
        const result = await seedVoteIfMissing({
            voteModel: UserVote,
            voteFilter: { userId: voter._id, targetUserId: target._id },
            counterModel: User,
            counterId: target._id,
            type: true,
            voterId: voter._id.toString(),
        });
        if (result) console.log(`⭐ ${voter.username} upvoted ${target.username}'s profile`);
    }
}

async function main() {
    try {
        await dbConnect();
        console.log("Connected to MongoDB");

        const args = process.argv.slice(2);
        const userArg = args.find((arg) => arg.startsWith("--user="));
        const userValue = userArg?.split("=")[1];
        if (userArg && !userValue) throw new Error("❌ Invalid --user argument");

        await retireLegacyPosts();

        const categories = await seedCategories();
        const demoUsers = await seedDemoUsers();

        // --user=<username/email> attaches sample posts to a real account; without it,
        // the first demo user owns them instead.
        let owner: UserDoc;
        if (userValue) {
            const found = await User.findOne({ $or: [{ username: userValue }, { email: userValue }] });
            if (!found) throw new Error(`❌ User not found for username/email: ${userValue}`);
            owner = found;
            console.log(`✅ Seeding posts under your account: ${owner.username || owner.email}`);
        } else {
            owner = demoUsers[0];
            console.log(`ℹ️ No --user= given — seeding posts under the default demo author: ${owner.username}`);
        }

        const posts = await seedOwnerPosts(owner._id, categories);
        await seedEngagement(owner, demoUsers, posts);
        await seedProfileVotes(owner, demoUsers);

        console.log(`🎉 Seeding completed. Demo users can log in with password: ${DEMO_PASSWORD}`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Error seeding data:", error);
        process.exit(1);
    }
}

main();
