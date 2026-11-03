import { hash } from "bcrypt";
import mongoose from "mongoose";
import { PASSWORD } from "../fixtures";

// Adds a realistic volume of data to an e2e database for the load test: 50 authors, 2,000 published
// posts of about 8 KB each with tags and categories, and 6,000 comments on the newest 200 posts.
async function seedVolume() {
    const uri = process.env.MONGODB_URI ?? "";
    if (!new URL(uri).pathname.slice(1).endsWith("_e2e")) throw new Error("Refusing a database whose name doesn't end in _e2e.");
    await mongoose.connect(uri);
    const db = mongoose.connection.db!;

    const password = await hash(PASSWORD, 10);
    const now = Date.now();
    const authors = Array.from({ length: 50 }, (_, i) => ({
        _id: new mongoose.Types.ObjectId(), username: `load.author${i}`, email: `load-author${i}@example.com`, firstName: "Load", lastName: `Author ${i}`,
        role: "author", password, upvoteCount: 0, downvoteCount: 0, emailVerifiedAt: new Date(now), createdAt: new Date(now), updatedAt: new Date(now),
    }));
    await db.collection("users").insertMany(authors);

    const categories = Array.from({ length: 8 }, (_, i) => ({ _id: new mongoose.Types.ObjectId(), title: `Category ${i}`, slug: `category-${i}`, content: "", visibility: true, deleted: false, createdAt: new Date(now), updatedAt: new Date(now) }));
    await db.collection("categories").insertMany(categories);

    const TAGS = ["javascript", "react", "nextjs", "mongodb", "devops", "design", "career", "security", "testing", "ai", "css", "performance"];
    const paragraph = "<p>" + "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ".repeat(6) + "</p>";
    const posts = Array.from({ length: 2000 }, (_, i) => {
        const at = new Date(now - (i + 1) * 3600_000);
        return {
            _id: new mongoose.Types.ObjectId(), userId: authors[i % authors.length]._id, categoryId: categories[i % categories.length]._id,
            slug: `load-post-${i}`, title: `Load test post number ${i} about ${TAGS[i % TAGS.length]}`, titleDescription: `Summary of load post ${i}`,
            tags: [TAGS[i % TAGS.length], TAGS[(i * 7) % TAGS.length]], bannerImage: "", content: `<h2>Section</h2>${paragraph.repeat(12)}`,
            summary: `Summary of load post ${i}`, upvoteCount: i % 17, downvoteCount: i % 3, commentCount: 0, visitorCount: i * 3,
            visibility: true, published: true, publishedAt: at, publishAt: null, approval: "Approved", approvedAt: at, deleted: false, createdAt: at, updatedAt: at,
        };
    });
    const comments = posts.slice(0, 200).flatMap((post, p) => Array.from({ length: 30 }, (_, c) => ({
        postId: post._id, parentId: null, userId: authors[(p + c) % authors.length]._id, content: `Comment ${c} on ${post.slug}: thoughtful remarks here.`,
        upvoteCount: c % 4, downvoteCount: 0, visibility: true, editedAt: null, deleted: false, createdAt: new Date(now), updatedAt: new Date(now),
    })));
    for (const post of posts.slice(0, 200)) post.commentCount = 30;
    await db.collection("posts").insertMany(posts);
    await db.collection("comments").insertMany(comments);
    await mongoose.disconnect();
    console.log(`Seeded ${authors.length} authors, ${posts.length} posts, ${comments.length} comments`);
}

seedVolume().catch((error) => {
    console.error(error);
    process.exit(1);
});
