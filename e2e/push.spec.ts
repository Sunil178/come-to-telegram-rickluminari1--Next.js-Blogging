import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BrowserType, type Page, type TestInfo } from "@playwright/test";
import { expect, expectNotification, login, newPage, presetConsent, SEEDED_POST, test, USERS } from "./fixtures";
import { withDb } from "./db";

// Bundled Chromium has no Google API keys and Playwright's Firefox build never answers subscribe(), so only the
// installed Chrome and Edge reach a real push service (Google FCM and Microsoft WNS).
const PUSH_PROJECTS = ["chrome", "msedge"];

// Push needs a persistent profile: Playwright's regular contexts are incognito-like, where Chrome and Edge refuse push.
async function pushPage(browserType: BrowserType, testInfo: TestInfo, email: string): Promise<{ page: Page; close: () => Promise<void> }> {
    const { baseURL, channel, launchOptions, viewport, userAgent, ignoreHTTPSErrors } = testInfo.project.use;
    const profile = await mkdtemp(join(tmpdir(), "e2e-push-"));
    // Against deploy/staging.sh's local CA, Chromium also needs the flag before it registers a service worker.
    const args = [...(launchOptions?.args ?? []), ...(ignoreHTTPSErrors ? ["--ignore-certificate-errors"] : [])];
    const context = await browserType.launchPersistentContext(profile, { ...launchOptions, args, channel, baseURL, viewport, userAgent, ignoreHTTPSErrors });
    await presetConsent(context, baseURL);
    await context.grantPermissions(["notifications"]);
    const page = context.pages()[0] ?? (await context.newPage());
    await login(page, email, undefined, "/dashboard/notifications");
    return { page, close: async () => { await context.close(); await rm(profile, { recursive: true, force: true }); } };
}

async function setPush(page: Page, enable: boolean) {
    await page.getByRole("button", { name: "Notifications" }).click();
    await page.getByRole("menuitem", { name: enable ? "Enable push notifications" : "Disable push notifications" }).click();
    await expect(page.getByText(enable ? "Push notifications enabled." : "Push notifications disabled.")).toBeVisible({ timeout: 90_000 });
}

function shownNotifications(page: Page) {
    return page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration("/");
        return (await registration!.getNotifications()).map((n) => `${n.title}: ${n.body}`);
    });
}

function subscriptionCount(username: string) {
    return withDb(async (db) => {
        const user = await db.collection("users").findOne({ username });
        return db.collection("pushsubscriptions").countDocuments({ userId: user!._id });
    });
}

test("a reader's comment reaches the author as a real Web Push notification, until push is switched off", async ({ browser, playwright, browserName }, testInfo) => {
    test.skip(!PUSH_PROJECTS.includes(testInfo.project.name), "needs a browser with a push service");
    test.setTimeout(240_000);

    // Chrome's first registration with Google's push service can take tens of seconds.
    const { page: authorPage, close } = await pushPage(playwright[browserName], testInfo, USERS.author.email);
    await setPush(authorPage, true);
    expect(await subscriptionCount(USERS.author.username)).toBe(1);

    const readerPage = await newPage(browser);
    await login(readerPage, USERS.reader.email, undefined, `/posts/${SEEDED_POST.slug}`);
    const comment = `Pushed comment ${Date.now()}`;
    await readerPage.getByLabel("Comment").first().fill(comment);
    await readerPage.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(readerPage.getByText(comment)).toBeVisible();

    // Delivered through the browser vendor's push service to the author's service worker.
    const expected = `New comment: ${USERS.reader.username} commented on your post "${SEEDED_POST.title}"`;
    await expect.poll(() => shownNotifications(authorPage), { timeout: 60_000, intervals: [1_000] }).toContain(expected);

    // The per-category push switch stops delivery while the in-app notification still arrives.
    await authorPage.reload();
    await authorPage.getByRole("checkbox", { name: "Comments on your posts: push" }).click();
    await authorPage.getByRole("button", { name: "Save preferences" }).click();
    await expect(authorPage.getByText("Notification preferences saved.")).toBeVisible();
    const commentNotice = `${USERS.reader.username} commented on your post`;
    const before = await authorPage.getByText(commentNotice).count();
    const muted = `Muted comment ${Date.now()}`;
    await readerPage.getByLabel("Comment").first().fill(muted);
    await readerPage.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(readerPage.getByText(muted)).toBeVisible();
    await expectNotification(authorPage, commentNotice, before + 1);
    // eslint-disable-next-line no-restricted-properties -- Checks that no second push arrives while push is off.
    await authorPage.waitForTimeout(5_000);
    expect((await shownNotifications(authorPage)).filter((n) => n === expected)).toHaveLength(1);

    await authorPage.getByRole("checkbox", { name: "Comments on your posts: push" }).click();
    await authorPage.getByRole("button", { name: "Save preferences" }).click();
    await expect(authorPage.getByText("Notification preferences saved.")).toBeVisible();

    await setPush(authorPage, false);
    expect(await subscriptionCount(USERS.author.username)).toBe(0);
    await close();
    await readerPage.context().close();
});
