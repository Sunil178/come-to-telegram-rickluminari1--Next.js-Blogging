import { readFile } from "node:fs/promises";
import { expect, login, newPage, PASSWORD, RELATED_POST, test, USERS } from "./fixtures";
import { createUser, withDb } from "./db";

test("the privacy policy is linked from every page and explains the cookies", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
    await expect(page.getByRole("heading", { name: "Privacy policy", level: 1 })).toBeVisible();
    await expect(page.getByText("vid", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Account" }).first()).toHaveAttribute("href", "/dashboard/account");
});

test("registration asks for at least 8 characters", async ({ page }) => {
    await page.goto("/auth/register");
    const password = page.locator("#password");
    await expect(page.getByText("At least 8 characters.")).toBeVisible();
    await expect(password).toHaveAttribute("minlength", "8");
});

test("a reader downloads their data without the password hash", async ({ page }) => {
    await login(page, USERS.reader.email, undefined, "/dashboard/account");
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download my data" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^vedev-account-\d{4}-\d{2}-\d{2}\.json$/);

    const data = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(data.profile.username).toBe(USERS.reader.username);
    expect(data.profile.password).toBeUndefined();
    expect(Object.keys(data)).toEqual(expect.arrayContaining(["posts", "comments", "votes", "notifications", "readingHistory"]));
});

test("deleting an account removes its content, keeps reply threads and corrects vote counts", async ({ browser }) => {
    const leaver = await createUser(`e2e.leaver${Date.now()}`, "author");
    const leaverId = leaver.id;
    const leaverPost = { slug: `e2e-leaver-post-${Date.now()}`, title: "A post that leaves with its author" };
    await withDb(async (db) => {
        const now = new Date();
        await db.collection("posts").insertOne({
            userId: leaverId, slug: leaverPost.slug, title: leaverPost.title, titleDescription: "", tags: [], content: "<p>Bye.</p>",
            bannerImage: "", upvoteCount: 0, downvoteCount: 0, commentCount: 0, visitorCount: 0, visibility: true, published: true,
            publishedAt: now, approval: "Approved", approvedAt: now, deleted: false, createdAt: now, updatedAt: now,
        });
    });
    const relatedVotes = () => withDb(async (db) => (await db.collection("posts").findOne({ slug: RELATED_POST.slug }))!.upvoteCount as number);
    const votesBefore = await relatedVotes();

    // The leaver upvotes and comments on someone else's post; a reader replies in their own browser.
    const leaverPage = await newPage(browser);
    await login(leaverPage, leaver.email, undefined, `/posts/${RELATED_POST.slug}`);
    await leaverPage.getByRole("button", { name: "Upvote" }).first().click();
    await expect(leaverPage.getByRole("button", { name: "Upvote" }).first()).toHaveAttribute("aria-pressed", "true");
    const leaverComment = `Leaving soon ${Date.now()}`;
    await leaverPage.getByLabel("Comment").first().fill(leaverComment);
    await leaverPage.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(leaverPage.getByText(leaverComment)).toBeVisible();
    expect(await relatedVotes()).toBe(votesBefore + 1);

    const readerPage = await newPage(browser);
    await login(readerPage, USERS.reader.email, undefined, `/posts/${RELATED_POST.slug}`);
    const reply = `A reply that should survive ${Date.now()}`;
    const thread = readerPage.locator("li, article, div").filter({ hasText: leaverComment }).last();
    await thread.getByRole("button", { name: "Reply" }).click();
    await readerPage.getByLabel("Comment").last().fill(reply);
    await readerPage.getByRole("button", { name: "Reply", exact: true }).last().click();
    await expect(readerPage.getByText(reply)).toBeVisible();

    // A wrong password deletes nothing.
    await leaverPage.goto("/dashboard/account");
    await leaverPage.getByRole("button", { name: "Delete my account…" }).click();
    await leaverPage.getByLabel("Confirm with your password").fill("not-my-password");
    await leaverPage.getByRole("button", { name: "Permanently delete account" }).click();
    await expect(leaverPage.getByRole("alert").filter({ hasText: "That password isn't correct." })).toBeVisible();

    await leaverPage.getByLabel("Confirm with your password").fill(PASSWORD);
    await leaverPage.getByRole("button", { name: "Permanently delete account" }).click();
    await expect(leaverPage).toHaveURL(/\/$/);
    await expect(leaverPage.getByText("Your account has been deleted.")).toBeVisible();

    await leaverPage.goto("/dashboard/account");
    await expect(leaverPage).toHaveURL(/\/auth\/login/);
    await leaverPage.getByLabel("Email").fill(leaver.email);
    await leaverPage.getByLabel("Password").fill(PASSWORD);
    await leaverPage.getByRole("button", { name: "Login" }).click();
    await expect(leaverPage).toHaveURL(/\/auth\/login/);
    // Streamed pages can't change the status once the loading shell is sent; Next marks them noindex instead.
    await leaverPage.goto(`/posts/${leaverPost.slug}`);
    await expect(leaverPage.getByRole("heading", { name: "Page not found" })).toBeVisible();

    await readerPage.reload();
    await expect(readerPage.getByText(leaverComment)).toHaveCount(0);
    // Scoped to this thread: earlier runs or other tests may have left placeholders on the same post.
    await expect(readerPage.getByRole("article").filter({ hasText: reply }).getByText("[deleted]").first()).toBeVisible();
    await expect(readerPage.getByText(reply)).toBeVisible();
    expect(await relatedVotes()).toBe(votesBefore);

    await withDb(async (db) => {
        expect(await db.collection("users").countDocuments({ email: leaver.email })).toBe(0);
        expect(await db.collection("posts").countDocuments({ slug: leaverPost.slug })).toBe(0);
        expect(await db.collection("comments").findOne({ content: leaverComment })).toBeNull();
        expect(await db.collection("post_votes").countDocuments({ userId: leaverId })).toBe(0);
        expect(await db.collection("comments").countDocuments({ userId: leaverId, content: { $ne: "[deleted]" } })).toBe(0);
        expect(await db.collection("comments").countDocuments({ userId: leaverId, deleted: true })).toBe(1);
    });
    await leaverPage.context().close();
    await readerPage.context().close();
});
