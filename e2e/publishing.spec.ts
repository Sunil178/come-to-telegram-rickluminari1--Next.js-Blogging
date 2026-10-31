import { expect, test } from "@playwright/test";
import { login, SEEDED_POST, USERS } from "./fixtures";

test("an author's post goes live only after a moderator approves it", async ({ browser }) => {
    const title = `E2E post ${Date.now()}`;

    const authorPage = await (await browser.newContext()).newPage();
    await login(authorPage, USERS.author.email, undefined, "/posts/add");
    await authorPage.getByLabel("Title").fill(title);
    await authorPage.getByLabel("Description").fill("Written by the end-to-end suite");
    const editor = authorPage.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially("Body text typed into the rich-text editor.");
    await authorPage.getByRole("button", { name: "Publish" }).click();
    await expect(authorPage).toHaveURL(/\/dashboard\/posts$/);

    const slug = title.toLowerCase().replace(/\s+/g, "-");
    const anonymous = await (await browser.newContext()).newPage();
    // Streaming (loading.tsx) sends a 200 before notFound() runs, so check what renders, not the status.
    await anonymous.goto(`/posts/${slug}`);
    await expect(anonymous.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(anonymous.getByText(title)).toHaveCount(0);

    const adminPage = await (await browser.newContext()).newPage();
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/admin/posts");
    await adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Approve post" }).click();
    await expect(adminPage.getByRole("row", { name: new RegExp(title) })).toHaveCount(0);

    await anonymous.goto(`/posts/${slug}`);
    await expect(anonymous.getByRole("heading", { name: title })).toBeVisible();
    // Scoped: while streaming, React briefly keeps a hidden copy of the segment outside the article.
    await expect(anonymous.getByRole("article").getByText("Body text typed into the rich-text editor.")).toBeVisible();
});

test("a reader's comment notifies the post's author", async ({ browser }) => {
    const readerPage = await (await browser.newContext()).newPage();
    await login(readerPage, USERS.reader.email, undefined, `/posts/${SEEDED_POST.slug}`);
    const comment = `Great post! ${Date.now()}`;
    await readerPage.getByLabel("Comment").first().fill(comment);
    await readerPage.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(readerPage.getByText(comment)).toBeVisible();

    const authorPage = await (await browser.newContext()).newPage();
    await login(authorPage, USERS.author.email);
    await authorPage.getByRole("button", { name: "Notifications" }).click();
    await expect(authorPage.getByText(`commented on your post "${SEEDED_POST.title}"`)).toBeVisible();
});
