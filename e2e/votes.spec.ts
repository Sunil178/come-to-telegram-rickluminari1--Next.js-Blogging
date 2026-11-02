import { type Locator, type Page } from "@playwright/test";
import { expect, login, newPage, test, USERS } from "./fixtures";
import { createPost, createUser, withDb } from "./db";

function voteBar(scope: Page | Locator) {
    const up = scope.getByRole("button", { name: "Upvote" }).first();
    const down = scope.getByRole("button", { name: "Downvote" }).first();
    // Each arrow shows its own count, so a switch moves each number by one.
    const shows = async (ups: number, downs: number) => {
        await expect(up).toHaveText(String(ups));
        await expect(down).toHaveText(String(downs));
    };
    return { up, down, shows };
}

const counts = (collection: string, filter: Record<string, unknown>) =>
    withDb(async (db) => {
        const doc = await db.collection(collection).findOne(filter);
        return { up: doc!.upvoteCount as number, down: doc!.downvoteCount as number };
    });

test("a post vote toggles, switches sides and survives a reload with the right counts", async ({ page }) => {
    const author = await createUser(`e2e.vauthor${Date.now()}`, "author");
    const post = await createPost(author.id);
    await login(page, USERS.reader.email, undefined, `/posts/${post.slug}`);
    const { up, down, shows } = voteBar(page.getByRole("article"));

    await up.click();
    await expect(up).toHaveAttribute("aria-pressed", "true");
    await shows(1, 0);
    expect(await counts("posts", { slug: post.slug })).toEqual({ up: 1, down: 0 });

    // Switching sides moves the vote rather than adding a second one.
    await down.click();
    await expect(down).toHaveAttribute("aria-pressed", "true");
    await expect(up).toHaveAttribute("aria-pressed", "false");
    await shows(0, 1);
    expect(await counts("posts", { slug: post.slug })).toEqual({ up: 0, down: 1 });

    await page.reload();
    await expect(down).toHaveAttribute("aria-pressed", "true");
    await shows(0, 1);

    // Clicking the active side again withdraws the vote.
    await down.click();
    await expect(down).toHaveAttribute("aria-pressed", "false");
    await shows(0, 0);
    expect(await counts("posts", { slug: post.slug })).toEqual({ up: 0, down: 0 });
    expect(await withDb((db) => db.collection("post_votes").countDocuments({ postId: post.id, deleted: false }))).toBe(0);
});

test("switching an upvote to a downvote on a post others voted on changes each count by one", async ({ page }) => {
    const author = await createUser(`e2e.vauthor${Date.now()}`, "author");
    const post = await createPost(author.id);
    const other = await createUser(`e2e.voter${Date.now()}`);
    const reader = await withDb((db) => db.collection("users").findOne({ email: USERS.reader.email }));
    // Another reader's upvote and this reader's own, with the stored counter drifted to 5.
    await withDb(async (db) => {
        const now = new Date();
        await db.collection("post_votes").insertMany([
            { postId: post.id, userId: other.id, type: true, deleted: false, createdAt: now, updatedAt: now },
            { postId: post.id, userId: reader!._id, type: true, deleted: false, createdAt: now, updatedAt: now },
        ]);
        await db.collection("posts").updateOne({ _id: post.id }, { $set: { upvoteCount: 5, downvoteCount: 0 } });
    });
    await login(page, USERS.reader.email, undefined, `/posts/${post.slug}`);
    const { up, down, shows } = voteBar(page.getByRole("article"));
    await expect(up).toHaveAttribute("aria-pressed", "true");

    await down.click();
    await expect(down).toHaveAttribute("aria-pressed", "true");
    // Recounted from the vote records: the drifted 5 is corrected, not decremented.
    await shows(1, 1);
    expect(await counts("posts", { slug: post.slug })).toEqual({ up: 1, down: 1 });
});

test("two readers' votes on a comment add up, and each reader can only change their own", async ({ browser }) => {
    const author = await createUser(`e2e.vauthor${Date.now()}`, "author");
    const post = await createPost(author.id);
    const text = `Vote on me ${Date.now()}`;
    const commentId = await withDb(async (db) => {
        const now = new Date();
        const { insertedId } = await db.collection("comments").insertOne({ postId: post.id, userId: author.id, parentId: null, content: text, upvoteCount: 0, downvoteCount: 0, deleted: false, createdAt: now, updatedAt: now });
        return insertedId;
    });

    const first = await newPage(browser);
    await login(first, USERS.reader.email, undefined, `/posts/${post.slug}`);
    const second = await newPage(browser);
    const other = await createUser(`e2e.voter${Date.now()}`);
    await login(second, other.email, undefined, `/posts/${post.slug}`);

    const block = (page: Page) => page.locator(`#comment-${commentId}`);
    await voteBar(block(first)).down.click();
    await voteBar(block(first)).shows(0, 1);
    await voteBar(block(second)).down.click();
    await voteBar(block(second)).shows(0, 2);
    await voteBar(block(second)).up.click();
    await voteBar(block(second)).shows(1, 1);
    expect(await counts("comments", { _id: commentId })).toEqual({ up: 1, down: 1 });

    await first.reload();
    await expect(voteBar(block(first)).down).toHaveAttribute("aria-pressed", "true");
    await voteBar(block(first)).shows(1, 1);
    await first.context().close();
    await second.context().close();
});

test("readers vote on an author's profile, but nobody votes on their own", async ({ browser }) => {
    const author = await createUser(`e2e.vauthor${Date.now()}`, "author");
    const readerPage = await newPage(browser);
    await login(readerPage, USERS.reader.email, undefined, `/users/${author.username}`);
    const { up, shows } = voteBar(readerPage.locator("main"));
    await up.click();
    await shows(1, 0);
    expect(await counts("users", { _id: author.id })).toEqual({ up: 1, down: 0 });
    await readerPage.reload();
    await expect(up).toHaveAttribute("aria-pressed", "true");

    const authorPage = await newPage(browser);
    await login(authorPage, author.email, undefined, `/users/${author.username}`);
    await expect(authorPage.locator("main").getByRole("button", { name: "Upvote" })).toHaveCount(0);
    const self = await authorPage.request.post(`/api/users/${author.username}/vote`, { data: { type: true } });
    expect(self.status()).toBe(400);
    await readerPage.context().close();
    await authorPage.context().close();
});

test("a logged-out visitor who votes is sent to log in and back", async ({ page }) => {
    const author = await createUser(`e2e.vauthor${Date.now()}`, "author");
    const post = await createPost(author.id);
    await page.goto(`/posts/${post.slug}`);
    await voteBar(page.getByRole("article")).up.click();
    await expect(page).toHaveURL(new RegExp(`/auth/login\\?callbackUrl=%2Fposts%2F${post.slug}`));
    expect(await counts("posts", { slug: post.slug })).toEqual({ up: 0, down: 0 });
});
