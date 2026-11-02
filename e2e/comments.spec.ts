import { type Page } from "@playwright/test";
import { expect, expectNotification, login, newPage, test, USERS } from "./fixtures";
import { createPost, createUser, withDb } from "./db";

// The innermost comment block holding this text; its own controls come before its replies'.
function comment(page: Page, text: string) {
    return page.locator('[id^="comment-"]').filter({ has: page.getByText(text, { exact: true }) }).last();
}

async function postComment(page: Page, text: string) {
    await page.getByLabel("Comment").first().fill(text);
    await page.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(comment(page, text)).toBeVisible();
    // Shown optimistically under a temporary id until the server's reply swaps in the real one.
    await expect(comment(page, text)).not.toHaveAttribute("id", /^comment-temp-/);
}

async function reply(page: Page, parentText: string, text: string) {
    await comment(page, parentText).getByRole("button", { name: "Reply" }).first().click();
    await comment(page, parentText).getByLabel("Comment").fill(text);
    await comment(page, parentText).getByRole("button", { name: "Reply", exact: true }).last().click();
    await expect(comment(page, text)).toBeVisible();
}

const commentCount = (slug: string) => withDb(async (db) => (await db.collection("posts").findOne({ slug }))!.commentCount as number);

test("a commenter edits their comment, and the edit survives a reload marked as edited", async ({ page }) => {
    const author = await createUser(`e2e.cauthor${Date.now()}`, "author");
    const post = await createPost(author.id);
    await login(page, USERS.reader.email, undefined, `/posts/${post.slug}`);
    const original = `First take ${Date.now()}`;
    await postComment(page, original);

    // Cancel leaves the text unchanged.
    await comment(page, original).getByRole("button", { name: "Edit" }).click();
    await comment(page, original).getByLabel("Comment").fill("Discarded edit");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(comment(page, original)).toBeVisible();

    const edited = `Second take ${Date.now()}`;
    await comment(page, original).getByRole("button", { name: "Edit" }).click();
    await page.locator('[id^="comment-"]').getByLabel("Comment").fill(edited);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(comment(page, edited)).toBeVisible();

    await page.reload();
    await expect(comment(page, edited)).toContainText("(edited)");
    await expect(page.getByText(original, { exact: true })).toHaveCount(0);
});

test("deleting comments keeps the thread readable and the post's count right", async ({ browser }) => {
    const author = await createUser(`e2e.cauthor${Date.now()}`, "author");
    const post = await createPost(author.id);
    const readerPage = await newPage(browser);
    await login(readerPage, USERS.reader.email, undefined, `/posts/${post.slug}`);
    const parent = `Parent ${Date.now()}`;
    const leaf = `Leaf ${Date.now()}`;
    await postComment(readerPage, parent);
    await postComment(readerPage, leaf);

    const otherPage = await newPage(browser);
    await login(otherPage, USERS.author.email, undefined, `/posts/${post.slug}`);
    const child = `Child reply ${Date.now()}`;
    const grandchild = `Grandchild reply ${Date.now()}`;
    await reply(otherPage, parent, child);
    await reply(otherPage, child, grandchild);
    // A reply notifies the parent comment's author.
    await expectNotification(readerPage, `${USERS.author.username} replied to your comment on "${post.title}"`);
    await readerPage.goto(`/posts/${post.slug}`);
    expect(await commentCount(post.slug)).toBe(4);

    // Others' comments offer no edit or delete.
    await expect(comment(readerPage, child).getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(comment(readerPage, child).getByRole("button", { name: "Delete" })).toHaveCount(0);

    // A comment without replies disappears.
    await comment(readerPage, leaf).getByRole("button", { name: "Delete" }).click();
    await readerPage.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(readerPage.getByText(leaf, { exact: true })).toHaveCount(0);

    // A comment with replies becomes a placeholder that keeps them.
    await comment(readerPage, parent).getByRole("button", { name: "Delete" }).first().click();
    await readerPage.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await readerPage.reload();
    await expect(readerPage.getByText(parent, { exact: true })).toHaveCount(0);
    await expect(readerPage.getByText("[deleted]")).toHaveCount(1);
    await expect(comment(readerPage, grandchild)).toBeVisible();
    expect(await commentCount(post.slug)).toBe(2);

    // Once its last reply is gone, the placeholder goes too.
    await otherPage.reload();
    await comment(otherPage, grandchild).getByRole("button", { name: "Delete" }).click();
    await otherPage.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await comment(otherPage, child).getByRole("button", { name: "Delete" }).first().click();
    await otherPage.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await otherPage.reload();
    await expect(otherPage.getByText("[deleted]")).toHaveCount(0);
    expect(await commentCount(post.slug)).toBe(0);
    await readerPage.context().close();
    await otherPage.context().close();
});

test("comment routes refuse other people's comments, empty text and overlong text", async ({ browser }) => {
    const author = await createUser(`e2e.cauthor${Date.now()}`, "author");
    const post = await createPost(author.id);
    const readerPage = await newPage(browser);
    await login(readerPage, USERS.reader.email, undefined, `/posts/${post.slug}`);
    const text = `Mine ${Date.now()}`;
    await postComment(readerPage, text);
    const id = (await comment(readerPage, text).getAttribute("id"))!.replace("comment-", "");

    const empty = await readerPage.request.post(`/api/posts/${post.slug}/comments`, { data: { content: "   " } });
    expect(empty.status()).toBe(400);
    const long = await readerPage.request.post(`/api/posts/${post.slug}/comments`, { data: { content: "x".repeat(5001) } });
    expect(long.status()).toBe(400);
    await expect(readerPage.getByLabel("Comment").first()).toHaveAttribute("maxlength", "5000");

    const otherPage = await newPage(browser);
    await login(otherPage, USERS.author.email, undefined, `/posts/${post.slug}`);
    expect((await otherPage.request.patch(`/api/comments/${id}`, { data: { content: "Hijacked" } })).status()).toBe(404);
    expect((await otherPage.request.delete(`/api/comments/${id}`)).status()).toBe(404);
    await readerPage.reload();
    await expect(comment(readerPage, text)).toBeVisible();
    await readerPage.context().close();
    await otherPage.context().close();
});

test("a logged-out visitor reads comments and is sent to log in to join", async ({ page }) => {
    const author = await createUser(`e2e.cauthor${Date.now()}`, "author");
    const post = await createPost(author.id);
    await withDb(async (db) => {
        const now = new Date();
        await db.collection("comments").insertOne({ postId: post.id, userId: author.id, parentId: null, content: "Visible to everyone", upvoteCount: 0, downvoteCount: 0, deleted: false, createdAt: now, updatedAt: now });
    });
    await page.goto(`/posts/${post.slug}`);
    await expect(comment(page, "Visible to everyone")).toBeVisible();
    await expect(page.getByLabel("Comment").first()).toBeDisabled();
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(new RegExp(`/auth/login\\?callbackUrl=%2Fposts%2F${post.slug}`));
});
