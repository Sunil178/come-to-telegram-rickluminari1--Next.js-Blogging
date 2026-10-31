import mongoose from "mongoose";
import { hash } from "bcrypt";
import { PASSWORD, SEEDED_POST, USERS } from "./fixtures";

// Resets the isolated e2e database. Run by playwright.config's webServer command *before* `next start`:
// Playwright starts the web server ahead of globalSetup, and dropping the database after the server
// boots would also drop the indexes Mongoose just built.
async function seed() {
    const uri = process.env.MONGODB_URI ?? "";
    const dbName = new URL(uri).pathname.slice(1);
    if (!dbName.endsWith("_e2e")) {
        throw new Error(`Refusing to reset "${dbName}": the e2e database name must end in "_e2e".`);
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db!;
    await db.dropDatabase();

    const password = await hash(PASSWORD, 10);
    const now = new Date();
    const users = await db.collection("users").insertMany(
        Object.values(USERS).map((u) => ({
            ...u,
            firstName: u.username.split(".")[1],
            lastName: "E2E",
            password,
            upvoteCount: 0,
            downvoteCount: 0,
            createdAt: now,
            updatedAt: now,
        }))
    );
    const authorId = users.insertedIds[1];

    await db.collection("posts").insertOne({
        userId: authorId,
        slug: SEEDED_POST.slug,
        title: SEEDED_POST.title,
        titleDescription: "Seeded for end-to-end tests",
        tags: ["e2e"],
        bannerImage: "",
        content: "<p>Hello from the seeded post.</p>",
        summary: "Seeded for end-to-end tests",
        upvoteCount: 0,
        downvoteCount: 0,
        commentCount: 0,
        visitorCount: 0,
        visibility: true,
        published: true,
        publishedAt: now,
        approval: "Approved",
        approvedAt: now,
        createdAt: now,
        updatedAt: now,
    });

    await mongoose.disconnect();
}

seed().catch((error) => {
    console.error(error);
    process.exit(1);
});
