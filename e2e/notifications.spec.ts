import { type Browser } from "@playwright/test";
import { expect, login, newPage, SEEDED_POST, test, USERS } from "./fixtures";

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
