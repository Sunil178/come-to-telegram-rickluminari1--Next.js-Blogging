import { clickNavLink, expect, expectSeen, login, newPage, test, USERS } from "./fixtures";
import { createPost, createUser, withDb } from "./db";

test("the posts list pages through more than one page of posts", async ({ page }) => {
    const author = await createUser(`e2e.pager${Date.now()}`, "author");
    const base = Date.now() - 20_000;
    // Newest first: these ten land ahead of the seeded posts (a future time would schedule them instead).
    for (let i = 0; i < 10; i++) await createPost(author.id, { title: `Paged post ${base} #${i}`, publishedAt: new Date(base + i * 1000) });

    await page.goto("/posts");
    await expectSeen(page.getByRole("link", { name: `Paged post ${base} #9` }).first());
    await expect(page.getByRole("link", { name: `Paged post ${base} #0` })).toHaveCount(0);
    // Each page's cards arrive by client navigation and must fade in, not stay hidden.
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expectSeen(page.getByRole("link", { name: `Paged post ${base} #0` }).first());
    await page.getByRole("link", { name: "Previous" }).click();
    await expectSeen(page.getByRole("link", { name: `Paged post ${base} #9` }).first());
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
    await clickNavLink(page, "Posts", true);
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
    // eslint-disable-next-line no-restricted-properties -- Checks that the count does not go up again.
    await page.waitForTimeout(1500);
    expect(await visits()).toBe(1);
});

test("the health check reports the app and database as up", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
});

test("search ranks title matches above tag and description matches, and a half-typed word still finds titles", async ({ page }) => {
    const author = await createUser(`e2e.searcher${Date.now()}`, "author");
    const word = `zephyrine${Date.now()}`;
    const now = Date.now();
    // Oldest first, so the order below can only come from relevance, not recency.
    const inTitle = await createPost(author.id, { title: `The ${word} handbook`, publishedAt: new Date(now - 30_000) });
    const inDescription = await createPost(author.id, { title: `Described post ${now}`, titleDescription: `All about ${word} in practice`, publishedAt: new Date(now - 20_000) });
    const inTags = await createPost(author.id, { title: `Tagged post ${now}`, tags: [word], publishedAt: new Date(now - 10_000) });
    await createPost(author.id, { title: `Unrelated post ${now}` });

    await page.goto(`/posts?q=${word}`);
    const main = page.locator("main");
    for (const post of [inTitle, inTags, inDescription]) await expect(main).toContainText(post.title);
    const text = await main.innerText();
    const positions = [inTitle, inTags, inDescription].map((post) => text.indexOf(post.title));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(text).not.toContain(`Unrelated post ${now}`);
    await expect(main.getByText("3 articles", { exact: false })).toBeVisible();

    await page.goto(`/posts?q=${word.slice(0, -4)}`);
    await expect(main).toContainText(inTitle.title);
    await expect(main).not.toContainText(inTags.title);

    // Stemmed: the plural finds the singular, and a half-typed last word still finds the title.
    await page.goto(`/posts?q=${word}s`);
    await expect(main).toContainText(inTitle.title);
    await page.goto(`/posts?q=the ${word.slice(0, -4)}`);
    await expect(main).toContainText(inTitle.title);
});

test("related posts put shared tags before the same category, and never show a deleted post", async ({ page }) => {
    const author = await createUser(`e2e.relater${Date.now()}`, "author");
    const stamp = Date.now();
    const categoryId = await withDb(async (db) => (await db.collection("categories").insertOne({ title: `Related ${stamp}`, slug: `related-${stamp}`, visibility: true, createdAt: new Date(), updatedAt: new Date() })).insertedId);
    const tag = `rel${stamp}`;
    const source = await createPost(author.id, { title: `Source ${stamp}`, tags: [tag], categoryId });
    const sameTag = await createPost(author.id, { title: `Same tag ${stamp}`, tags: [tag], publishedAt: new Date(stamp - 60_000) });
    const sameCategory = await createPost(author.id, { title: `Same category ${stamp}`, categoryId });
    const deleted = await createPost(author.id, { title: `Deleted ${stamp}`, categoryId, tags: [tag], deleted: true, deletedAt: new Date() });

    await page.goto(`/posts/${source.slug}`);
    const related = page.getByRole("region", { name: "Related posts" });
    await expect(related).toContainText(sameTag.title);
    await expect(related).toContainText(sameCategory.title);
    await expect(related).not.toContainText(deleted.title);
    const text = await related.innerText();
    expect(text.indexOf(sameTag.title)).toBeLessThan(text.indexOf(sameCategory.title));
});

test("unknown, deleted and non-public posts show readers the not-found page", async ({ browser }) => {
    const authorId = await withDb(async (db) => (await db.collection("users").findOne({ email: USERS.author.email }))!._id);
    const pending = await createPost(authorId, { approval: "Pending", published: false });
    const scheduled = await createPost(authorId, { publishedAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    const hidden = await createPost(authorId, { visibility: false });
    const deleted = await createPost(authorId, { deleted: true, deletedAt: new Date() });

    const reader = await newPage(browser);
    for (const slug of ["no-such-post-anywhere", pending.slug, scheduled.slug, hidden.slug, deleted.slug]) {
        await reader.goto(`/posts/${slug}`);
        await expect(reader.getByRole("heading", { name: "Page not found" })).toBeVisible();
    }
    await reader.context().close();

    // The author can still open their own pending post; a deleted one is gone for everyone.
    const author = await newPage(browser);
    await login(author, USERS.author.email, undefined, `/posts/${pending.slug}`);
    await expect(author.getByRole("heading", { name: pending.title })).toBeVisible();
    await author.goto(`/posts/${deleted.slug}`);
    await expect(author.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await author.context().close();
});
