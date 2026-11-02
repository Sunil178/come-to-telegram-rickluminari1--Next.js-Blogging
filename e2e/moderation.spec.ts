import { type Page } from "@playwright/test";
import { expect, expectNotification, login, newPage, test } from "./fixtures";
import { createUser, withDb } from "./db";

async function writePost(page: Page, title: string, category?: string) {
    await page.goto("/posts/add");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("Written by the moderation suite");
    if (category) await page.getByLabel("Category").selectOption({ label: category });
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially("A body worth moderating.");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page).toHaveURL(/\/dashboard\/posts$/);
}

test("a rejected post carries the moderator's reason, and the author's edit sends it back for review", async ({ browser }) => {
    test.setTimeout(120_000);
    const author = await createUser(`e2e.rejected${Date.now()}`, "author");
    const categoryTitle = `Moderated ${Date.now()}`;
    await withDb((db) => db.collection("categories").insertOne({ title: categoryTitle, slug: categoryTitle.toLowerCase().replace(/\s+/g, "-"), visibility: true, deleted: false }));
    const title = `Needs work ${Date.now()}`;
    const slug = title.toLowerCase().replace(/\s+/g, "-");

    const moderator = await createUser(`e2e.moderator${Date.now()}`, "moderator");

    const authorPage = await newPage(browser);
    await login(authorPage, author.email, undefined, "/dashboard/posts");
    await writePost(authorPage, title, categoryTitle);

    // Moderators hear about the new post; the moderation queue lists it.
    const moderatorPage = await newPage(browser);
    await login(moderatorPage, moderator.email, undefined, "/dashboard/notifications");
    await expectNotification(moderatorPage, `${author.username} submitted "${title}" for review`);
    await moderatorPage.goto("/dashboard/admin/posts");
    const row = moderatorPage.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Reject post" }).click();
    await moderatorPage.getByLabel("Reason (optional)").fill("Please cite your sources.");
    await moderatorPage.getByRole("dialog").getByRole("button", { name: "Reject post" }).click();
    await expect(moderatorPage.getByText("Post rejected.")).toBeVisible();
    // Handled: the moderator's own notification is no longer unread.
    expect(await withDb(async (db) => {
        const post = await db.collection("posts").findOne({ slug });
        return db.collection("notifications").countDocuments({ type: "post_submitted", postId: post!._id, read: false });
    })).toBe(0);

    // The author is told, and the notification leads to the edit page with the reason.
    await expectNotification(authorPage, `Your post "${title}" was rejected`);
    await authorPage.getByRole("link", { name: new RegExp(`Your post "${title}" was rejected`) }).first().click();
    await expect(authorPage).toHaveURL(new RegExp(`/posts/${slug}/edit`));
    await expect(authorPage.getByText("Please cite your sources.")).toBeVisible();
    await expect(authorPage.getByLabel("Category")).toHaveValue(/[a-f0-9]{24}/);

    const anonymous = await newPage(browser);
    await anonymous.goto(`/posts/${slug}`);
    await expect(anonymous.getByRole("heading", { name: "Page not found" })).toBeVisible();

    // Saving the edit resubmits it, and moderators hear about it again.
    const editor = authorPage.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.press("End");
    await editor.pressSequentially(" Sources: the docs.");
    await authorPage.getByRole("button", { name: "Save changes" }).click();
    await expect.poll(() => withDb(async (db) => (await db.collection("posts").findOne({ slug }))!.approval)).toBe("Pending");
    await moderatorPage.goto("/dashboard/notifications");
    await expectNotification(moderatorPage, `${author.username} submitted "${title}" for review`, 2);

    await moderatorPage.goto("/dashboard/admin/posts");
    await moderatorPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Approve post" }).click();
    await expect(moderatorPage.getByText("Post approved.")).toBeVisible();
    await anonymous.goto(`/posts/${slug}`);
    await expect(anonymous.getByRole("heading", { name: title })).toBeVisible();
    await anonymous.getByRole("link", { name: categoryTitle }).first().click();
    await expect(anonymous).toHaveURL(/category=/);
    await expect(anonymous.getByRole("link", { name: title }).first()).toBeVisible();
    for (const page of [authorPage, moderatorPage, anonymous]) await page.context().close();
});

test("an author deletes their own post, but not anyone else's", async ({ browser }) => {
    const author = await createUser(`e2e.deleter${Date.now()}`, "author");
    const title = `Short-lived ${Date.now()}`;
    const slug = title.toLowerCase().replace(/\s+/g, "-");
    const authorPage = await newPage(browser);
    await login(authorPage, author.email, undefined, "/dashboard/posts");
    await writePost(authorPage, title);

    // Someone else's post can't be deleted through the API.
    expect((await authorPage.request.delete("/api/posts/e2e-welcome")).status()).toBe(404);

    const row = authorPage.getByRole("row", { name: new RegExp(title) });
    await row.getByRole("button", { name: "Delete post" }).click();
    await authorPage.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(authorPage.getByText("Post deleted.")).toBeVisible();
    await expect(row).toHaveCount(0);
    expect(await withDb((db) => db.collection("posts").countDocuments({ slug, deleted: false }))).toBe(0);
    await authorPage.context().close();
});
