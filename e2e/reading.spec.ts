import { expect, test } from "./fixtures";
import { createPost, createUser, withDb } from "./db";

test("the posts list pages through more than one page of posts", async ({ page }) => {
    const author = await createUser(`e2e.pager${Date.now()}`, "author");
    const base = Date.now() - 20_000;
    // Newest first: these ten land ahead of the seeded posts (a future time would schedule them instead).
    for (let i = 0; i < 10; i++) await createPost(author.id, { title: `Paged post ${base} #${i}`, publishedAt: new Date(base + i * 1000) });

    await page.goto("/posts");
    await expect(page.getByRole("link", { name: `Paged post ${base} #9` }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: `Paged post ${base} #0` })).toHaveCount(0);
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole("link", { name: `Paged post ${base} #0` }).first()).toBeVisible();
    await page.getByRole("link", { name: "Previous" }).click();
    await expect(page.getByRole("link", { name: `Paged post ${base} #9` }).first()).toBeVisible();
});

test("an author's profile lists their published posts only", async ({ page }) => {
    const author = await createUser(`e2e.profile${Date.now()}`, "author");
    const live = await createPost(author.id);
    const pending = await createPost(author.id, { approval: "Pending", published: false, publishedAt: null, approvedAt: null });
    await page.goto(`/users/${author.username}`);
    await expect(page.getByRole("heading", { name: author.username })).toBeVisible();
    await expect(page.getByRole("link", { name: live.title }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: pending.title })).toHaveCount(0);

    await page.goto(`/users/nobody-${Date.now()}`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("the RSS feed, sitemap and robots.txt list public posts and nothing private", async ({ request }) => {
    const author = await createUser(`e2e.feed${Date.now()}`, "author");
    const live = await createPost(author.id);
    const pending = await createPost(author.id, { approval: "Pending", published: false, publishedAt: null, approvedAt: null });

    const feed = await request.get("/feed.xml");
    expect(feed.headers()["content-type"]).toContain("xml");
    const xml = await feed.text();
    expect(xml).toContain(`/posts/${live.slug}`);
    expect(xml).not.toContain(pending.slug);

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/posts/${live.slug}`);
    expect(sitemap).not.toContain(pending.slug);

    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/dashboard/);
    expect(robots).toContain("Sitemap:");
});

test("the theme choice persists across pages and reloads", async ({ page }) => {
    await page.goto("/posts");
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitemradio", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("on a phone, the menu opens, navigates and closes", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Posts" }).last().click();
    await expect(page).toHaveURL(/\/posts$/);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    // No horizontal scrolling at phone width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await context.close();
});

test("a post's visitor count goes up once per visitor address, not on every reload", async ({ page }) => {
    const author = await createUser(`e2e.views${Date.now()}`, "author");
    const post = await createPost(author.id);
    const visits = () => withDb(async (db) => (await db.collection("posts").findOne({ _id: post.id }))!.visitorCount as number);
    await page.goto(`/posts/${post.slug}`);
    await expect.poll(visits).toBe(1);
    await page.reload();
    // A fresh browser from the same address doesn't count again either (deduplicated per hashed IP).
    await page.context().clearCookies();
    await page.reload();
    await page.waitForTimeout(1500);
    expect(await visits()).toBe(1);
});

test("the health check reports the app and database as up", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
});
