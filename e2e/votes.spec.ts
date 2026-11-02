import { type Locator, type Page } from "@playwright/test";
import { expect, login, newPage, test, USERS } from "./fixtures";
import { createPost, createUser, withDb } from "./db";

function voteBar(scope: Page | Locator) {
    const up = scope.getByRole("button", { name: "Upvote" }).first();
    const down = scope.getByRole("button", { name: "Downvote" }).first();
    // The score sits between the two buttons.
    const score = up.locator("xpath=following-sibling::span[1]");
    return { up, down, score };
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
    const { up, down, score } = voteBar(page.getByRole("article"));

    await up.click();
    await expect(up).toHaveAttribute("aria-pressed", "true");
    await expect(score).toHaveText("1");
    expect(await counts("posts", { slug: post.slug })).toEqual({ up: 1, down: 0 });

    // Switching sides moves the vote rather than adding a second one.
    await down.click();
    await expect(down).toHaveAttribute("aria-pressed", "true");
    await expect(up).toHaveAttribute("aria-pressed", "false");
    await expect(score).toHaveText("-1");
    expect(await counts("posts", { slug: post.slug })).toEqual({ up: 0, down: 1 });

    await page.reload();
    await expect(down).toHaveAttribute("aria-pressed", "true");
    await expect(score).toHaveText("-1");

    // Clicking the active side again withdraws the vote.
    await down.click();
    await expect(down).toHaveAttribute("aria-pressed", "false");
    await expect(score).toHaveText("0");
    expect(await counts("posts", { slug: post.slug })).toEqual({ up: 0, down: 0 });
    expect(await withDb((db) => db.collection("post_votes").countDocuments({ postId: post.id, deleted: false }))).toBe(0);
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
    await expect(voteBar(block(first)).score).toHaveText("-1");
    await voteBar(block(second)).down.click();
    await expect(voteBar(block(second)).score).toHaveText("-2");
    await voteBar(block(second)).up.click();
    await expect(voteBar(block(second)).score).toHaveText("0");
    expect(await counts("comments", { _id: commentId })).toEqual({ up: 1, down: 1 });

    await first.reload();
    await expect(voteBar(block(first)).down).toHaveAttribute("aria-pressed", "true");
    await expect(voteBar(block(first)).score).toHaveText("0");
    await first.context().close();
    await second.context().close();
});

test("readers vote on an author's profile, but nobody votes on their own", async ({ browser }) => {
    const author = await createUser(`e2e.vauthor${Date.now()}`, "author");
    const readerPage = await newPage(browser);
    await login(readerPage, USERS.reader.email, undefined, `/users/${author.username}`);
    const { up, score } = voteBar(readerPage.locator("main"));
    await up.click();
    await expect(score).toHaveText("1");
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
