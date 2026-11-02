import { type Page } from "@playwright/test";
import { expect, login, newPage, RELATED_POST, SEEDED_POST, test, USERS } from "./fixtures";

// datetime-local wants local wall-clock time without a zone.
function localInputValue(date: Date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

async function writePost(page: Page, title: string, publishAt?: Date) {
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("Written by the content suite");
    if (publishAt) await page.getByLabel("Publish at (optional)").fill(localInputValue(publishAt));
    const editor = page.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially("Scheduled body text.");
}

test("a scheduled post stays hidden after approval until its publish time, and goes live when the schedule is cleared", async ({ browser }) => {
    const title = `Scheduled ${Date.now()}`;
    const slug = title.toLowerCase().replace(/\s+/g, "-");

    const authorPage = await newPage(browser);
    await login(authorPage, USERS.author.email, undefined, "/posts/add");
    await writePost(authorPage, title, new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
    await authorPage.getByRole("button", { name: "Publish" }).click();
    await expect(authorPage).toHaveURL(/\/dashboard\/posts$/);

    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/admin/posts");
    await adminPage.getByRole("row", { name: new RegExp(title) }).getByRole("button", { name: "Approve post" }).click();
    await expect(adminPage.getByRole("row", { name: new RegExp(title) })).toHaveCount(0);

    const anonymous = await newPage(browser);
    await anonymous.goto(`/posts/${slug}`);
    await expect(anonymous.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await anonymous.goto("/posts");
    await expect(anonymous.getByText(title)).toHaveCount(0);

    await authorPage.reload();
    await expect(authorPage.getByRole("row", { name: new RegExp(title) }).getByText("Scheduled", { exact: true })).toBeVisible();

    await authorPage.goto(`/posts/${slug}/edit`);
    await authorPage.getByLabel("Publish at (optional)").fill("");
    await authorPage.getByRole("button", { name: "Save changes" }).click();
    await expect(authorPage).toHaveURL(/\/dashboard\/posts$/);

    await anonymous.goto(`/posts/${slug}`);
    await expect(anonymous.getByRole("heading", { name: title })).toBeVisible();
});

test("an edit keeps the previous version, which can be restored from the revision history", async ({ page }) => {
    await login(page, USERS.author.email, undefined, `/posts/${SEEDED_POST.slug}/edit`);
    const title = page.getByLabel("Title");
    await expect(title).toHaveValue(SEEDED_POST.title);
    await title.fill("A temporarily renamed post");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/dashboard\/posts$/);

    await page.goto(`/posts/${SEEDED_POST.slug}/revisions`);
    await page.getByRole("link", { name: new RegExp(SEEDED_POST.title) }).click();
    await expect(page.getByRole("heading", { level: 2, name: SEEDED_POST.title })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Restore this version" }).click();
    await expect(page.getByText("Revision restored.")).toBeVisible();
    // Let the app's own navigation finish; Firefox aborts a second navigation started on top of it.
    await expect(page).toHaveURL(new RegExp(`/posts/${SEEDED_POST.slug}/revisions$`));

    await page.goto(`/posts/${SEEDED_POST.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: SEEDED_POST.title })).toBeVisible();
    // The restore itself kept the renamed version in the history.
    await page.goto(`/posts/${SEEDED_POST.slug}/revisions`);
    await expect(page.getByRole("link", { name: /A temporarily renamed post/ })).toBeVisible();
});

test("the editor autosaves a draft that survives a reload", async ({ page }) => {
    await login(page, USERS.author.email, undefined, "/posts/add");
    await page.getByLabel("Title").fill("Unsaved thoughts");
    await expect(page.getByText(/Draft saved at/)).toBeVisible();

    await page.reload();
    await expect(page.getByText("You have an unsaved draft")).toBeVisible();
    await page.getByRole("button", { name: "Restore draft" }).click();
    await expect(page.getByLabel("Title")).toHaveValue("Unsaved thoughts");

    await page.reload();
    await page.getByRole("button", { name: "Discard" }).click();
    await page.reload();
    await expect(page.getByText("You have an unsaved draft")).toHaveCount(0);
});

test("a post lists related posts that share its tags", async ({ page }) => {
    await page.goto(`/posts/${SEEDED_POST.slug}`);
    const related = page.getByRole("region", { name: "Related posts" });
    await expect(related.getByRole("link", { name: new RegExp(RELATED_POST.title) })).toBeVisible();
});

test("clearing the posts search brings every post back, even when cleared in pauses", async ({ page }) => {
    await page.goto("/posts");
    const search = page.getByLabel("Search articles");
    await search.fill(SEEDED_POST.title);
    await expect(page).toHaveURL(/q=/);
    await expect(page.getByRole("link", { name: RELATED_POST.title })).toHaveCount(0);

    // Delete a few characters at a time and let each partial query's results arrive: the box must keep
    // the user's text and focus through every navigation.
    const urlQuery = () => new URL(page.url()).searchParams.get("q") ?? "";
    let expected = SEEDED_POST.title;
    await search.press("End");
    while (expected.length > 0) {
        for (let i = 0; i < 3 && expected.length > 0; i++) {
            await search.press("Backspace");
            expected = expected.slice(0, -1);
        }
        await expect.poll(urlQuery).toBe(expected.trim());
        await expect(search).toHaveValue(expected);
    }
    await expect(search).toBeFocused();
    await expect(page).not.toHaveURL(/q=/);
    await expect(page.getByRole("link", { name: RELATED_POST.title }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: SEEDED_POST.title }).first()).toBeVisible();

    // A navigation the box didn't make (the navbar's Posts link) empties it.
    await search.fill("Welcome");
    await expect.poll(urlQuery).toBe("Welcome");
    await page.getByRole("banner").getByRole("link", { name: "Posts", exact: true }).click();
    await expect.poll(urlQuery).toBe("");
    await expect(search).toHaveValue("");
});

test("the editor and dashboard pages stream their own loading skeletons, not the posts grid", async ({ page }) => {
    await login(page, USERS.author.email, undefined, "/dashboard/posts");
    // The loading.tsx fallback is part of the streamed HTML, before the page itself.
    const add = await (await page.request.get("/posts/add")).text();
    expect(add).toContain('aria-label="Loading editor"');
    const edit = await (await page.request.get(`/posts/${SEEDED_POST.slug}/edit`)).text();
    expect(edit).toContain('aria-label="Loading editor"');
    const notifications = await (await page.request.get("/dashboard/notifications")).text();
    expect(notifications).toContain('aria-label="Loading page"');
});
