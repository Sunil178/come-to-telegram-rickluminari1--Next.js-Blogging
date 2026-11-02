import { type Browser } from "@playwright/test";
import { expect, expectNotification, login, newPage, SEEDED_POST, test, USERS } from "./fixtures";
import { createUser, withDb } from "./db";

async function upvoteSeededPost(browser: Browser, email: string) {
    const page = await newPage(browser);
    await login(page, email, undefined, `/posts/${SEEDED_POST.slug}`);
    const upvote = page.getByRole("button", { name: "Upvote" }).first();
    await upvote.click();
    await expect(upvote).toHaveAttribute("aria-pressed", "true");
    return { page, upvote };
}

test("an author sees upvotes on the notifications page and can switch them off", async ({ browser }) => {
    const { page: readerPage, upvote } = await upvoteSeededPost(browser, USERS.reader.email);
    // Toggling the vote off and on again must not notify twice.
    await upvote.click();
    await expect(upvote).toHaveAttribute("aria-pressed", "false");
    await upvote.click();
    await expect(upvote).toHaveAttribute("aria-pressed", "true");
    await readerPage.context().close();

    const authorPage = await newPage(browser);
    await login(authorPage, USERS.author.email, undefined, "/dashboard/notifications");
    await expectNotification(authorPage, `${USERS.reader.username} upvoted your post "${SEEDED_POST.title}"`);
    const readerUpvote = authorPage.getByText(`${USERS.reader.username} upvoted your post "${SEEDED_POST.title}"`);
    await expect(readerUpvote).toHaveCount(1);

    await authorPage.getByRole("checkbox", { name: "Upvotes on your posts and comments: in-app" }).click();
    await authorPage.getByRole("button", { name: "Save preferences" }).click();
    await expect(authorPage.getByText("Notification preferences saved.")).toBeVisible();

    const { page: adminPage } = await upvoteSeededPost(browser, USERS.admin.email);
    await adminPage.context().close();

    await authorPage.reload();
    await expect(authorPage.getByRole("checkbox", { name: "Upvotes on your posts and comments: in-app" })).not.toBeChecked();
    await expect(readerUpvote).toHaveCount(1);
    await expect(authorPage.getByText(`${USERS.admin.username} upvoted your post`)).toHaveCount(0);

    await authorPage.getByRole("button", { name: "Mark all read" }).click();
    await expect(authorPage.getByRole("button", { name: "Mark all read" })).toHaveCount(0);
    await authorPage.getByRole("button", { name: "Notifications" }).click();
    await expect(authorPage.getByRole("menuitem", { name: "View all and settings" })).toBeVisible();
});

test("the web app manifest offers installable PNG icons", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    const sizes = manifest.icons.filter((icon: { type: string }) => icon.type === "image/png").map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const size of [192, 512]) {
        const response = await request.get(`/icons/icon-${size}.png`);
        expect(response.status()).toBe(200);
        expect(response.headers()["content-type"]).toBe("image/png");
    }
});

test("a reader's request to publish reaches the admins, and the approval reaches the reader", async ({ browser }) => {
    test.setTimeout(150_000);
    const newbie = await createUser(`e2e.newbie${Date.now()}`);
    const newbiePage = await newPage(browser);
    await login(newbiePage, newbie.email, undefined, "/dashboard/posts");
    await newbiePage.getByRole("button", { name: "Request to publish" }).click();
    await expect(newbiePage.getByText("Request sent — an admin will review it.")).toBeVisible();
    // A reload remembers the pending request instead of offering the button again.
    await newbiePage.reload();
    await expect(newbiePage.getByText("Your request to publish is pending review.")).toBeVisible();
    await expect(newbiePage.getByRole("button", { name: "Request to publish" })).toHaveCount(0);

    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/notifications");
    await expectNotification(adminPage, `${newbie.username} asked to become an author`);
    // Bell entries are links and look clickable.
    await adminPage.getByRole("button", { name: "Notifications" }).click();
    const bellItem = adminPage.getByRole("menuitem", { name: new RegExp(`${newbie.username} asked to become an author`) }).first();
    expect(await bellItem.evaluate((el) => getComputedStyle(el).cursor)).toBe("pointer");
    await adminPage.keyboard.press("Escape");
    await adminPage.goto("/dashboard/admin/requests");
    const row = adminPage.getByRole("row").filter({ hasText: newbie.email });
    await row.getByRole("button", { name: "Approve request" }).click();
    await expect(adminPage.getByText("Request approved — user is now an Author.")).toBeVisible();
    // Handled requests stop counting as unread in every admin's bell.
    expect(await withDb(async (db) => {
        const user = await db.collection("users").findOne({ email: newbie.email });
        return db.collection("notifications").countDocuments({ type: "publish_request", actorId: user!._id, read: false });
    })).toBe(0);
    await adminPage.context().close();

    await expectNotification(newbiePage, "Your request to publish was approved. You can write posts now");
    // The session picks up the new role at its next check (within a minute), without signing in again.
    await expect.poll(async () => {
        await newbiePage.goto("/posts/add");
        return new URL(newbiePage.url()).pathname;
    }, { timeout: 90_000, intervals: [5_000] }).toBe("/posts/add");
    await newbiePage.context().close();
});

test("an upvote on a reader's comment notifies the reader", async ({ browser }) => {
    const commenter = await createUser(`e2e.commenter${Date.now()}`);
    const commenterPage = await newPage(browser);
    await login(commenterPage, commenter.email, undefined, `/posts/${SEEDED_POST.slug}`);
    const comment = `Worth an upvote ${Date.now()}`;
    await commenterPage.getByLabel("Comment").first().fill(comment);
    await commenterPage.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(commenterPage.getByText(comment)).toBeVisible();

    const authorPage = await newPage(browser);
    await login(authorPage, USERS.author.email, undefined, `/posts/${SEEDED_POST.slug}`);
    const upvote = authorPage.locator("li, article, div").filter({ hasText: comment }).last().getByRole("button", { name: "Upvote" });
    await upvote.click();
    await expect(upvote).toHaveAttribute("aria-pressed", "true");
    await authorPage.context().close();

    await expectNotification(commenterPage, `${USERS.author.username} upvoted your comment on "${SEEDED_POST.title}"`);
    await commenterPage.context().close();
});

test("MongoDB's TTL monitor deletes old read notifications and keeps unread ones", async () => {
    test.setTimeout(150_000);
    const longAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
    const [readId, unreadId] = await withDb(async (db) => {
        expect((await db.collection("notifications").indexes()).find((index) => index.name === "readAt_ttl")?.expireAfterSeconds).toBe(90 * 86400);
        const recipient = await db.collection("users").findOne({ username: USERS.reader.username });
        const base = { recipientId: recipient!._id, actorId: null, type: "post_approved", postId: null, commentId: null, createdAt: longAgo, updatedAt: longAgo };
        const { insertedIds } = await db.collection("notifications").insertMany([{ ...base, readAt: longAgo }, { ...base, readAt: null }]);
        return [insertedIds[0], insertedIds[1]];
    });
    // The monitor runs once a minute.
    await expect.poll(() => withDb((db) => db.collection("notifications").countDocuments({ _id: readId })), { timeout: 130_000, intervals: [5_000] }).toBe(0);
    expect(await withDb((db) => db.collection("notifications").countDocuments({ _id: unreadId }))).toBe(1);
});
