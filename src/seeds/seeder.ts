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
import postsData from "./posts.json";
import categoriesData from "./categories.json";
import usersData from "./users.json";
import commentTemplates from "./comment-templates.json";

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

async function seedOwnerPosts(ownerId: Types.ObjectId, categories: Record<string, Types.ObjectId>): Promise<PostDoc[]> {
    const posts: PostDoc[] = [];
    for (const raw of postsData) {
        const existing = await Post.findOne({ slug: raw.slug });
        if (existing) {
            console.log(`⚠️ Post already exists: ${raw.slug}`);
            posts.push(existing);
            continue;
        }

        const categoryId = categories[raw.categorySlug];
        if (!categoryId) {
            console.log(`❌ Category not found for slug: ${raw.categorySlug}, skipping...`);
            continue;
        }

        // upvoteCount/downvoteCount are dropped here rather than trusted from the fixture —
        // seedEngagement() below backs them with real PostVote documents via toggleVote(),
        // the same helper the app itself uses, so the counts are never fabricated.
        const { categorySlug: _categorySlug, upvoteCount: _upvoteCount, downvoteCount: _downvoteCount, ...rest } = raw;
        const post = await Post.create({ ...rest, userId: ownerId, categoryId });
        console.log(`📝 Post created: ${raw.title}`);
        posts.push(post);
    }
    return posts;
}

// Only creates the vote if this voter hasn't already voted on this target — toggleVote()
// itself would flip an existing vote off, which would make re-running the seeder destructive.
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

// Votes and threaded comments on every publicly visible post, from the demo users (never the
// post's own owner — the app's own vote routes disallow that same shape of self-engagement).
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

// Reputation votes on user profiles: every demo user upvotes the post owner's profile, plus a
// light round of cross-voting between demo users so UserVote isn't seeded one-directionally.
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

        const categories = await seedCategories();
        const demoUsers = await seedDemoUsers();

        // --user=<username/email> attaches the sample posts to a real account so they show up
        // in your own dashboard. Without it, the first demo user owns them instead — still a
        // real, fully-functional account, just not one you're logged into.
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
