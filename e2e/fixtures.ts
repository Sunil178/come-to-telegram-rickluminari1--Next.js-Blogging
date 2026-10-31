import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export { expect };

// Every test browser starts with a stored consent choice, so the cookie banner (fixed at the bottom
// of every page) doesn't cover the controls tests click. consent.spec.ts opts out to test the banner.
export async function presetConsent(context: BrowserContext, baseURL: string | undefined) {
    await context.addCookies([{ name: "consent", value: "denied", url: baseURL ?? "http://localhost:5100" }]);
}

export const test = base.extend({
    // "provide" is Playwright's `use` callback, renamed so the React hooks lint rule doesn't mistake it for a hook.
    context: async ({ context, baseURL }, provide) => {
        await presetConsent(context, baseURL);
        await provide(context);
    },
});

// browser.newContext() inherits the config's baseURL; it just doesn't go through the context fixture.
export async function newPage(browser: Browser): Promise<Page> {
    const context = await browser.newContext();
    await presetConsent(context, test.info().project.use.baseURL);
    return context.newPage();
}

export const PASSWORD = "Passw0rd!";
export const USERS = {
    admin: { email: "e2e-admin@example.com", username: "e2e.admin", role: "admin" },
    author: { email: "e2e-author@example.com", username: "e2e.author", role: "author" },
    reader: { email: "e2e-reader@example.com", username: "e2e.reader", role: "reader" },
} as const;
export const SEEDED_POST = { slug: "e2e-welcome", title: "Welcome to the end-to-end suite" };
export const RELATED_POST = { slug: "e2e-related", title: "A related end-to-end post" };

// Notifications are written after the response (after()), so a page can render before they exist: reload until it shows.
export async function expectNotification(page: Page, text: string, atLeast = 1) {
    await expect.poll(async () => {
        await page.goto("/dashboard/notifications");
        return page.getByText(text).count();
    }, { timeout: 15_000 }).toBeGreaterThanOrEqual(atLeast);
}

export async function login(page: Page, email: string, password = PASSWORD, callbackUrl = "/posts") {
    await page.goto(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(new RegExp(`${callbackUrl.replace(/[/?]/g, "\\$&")}$`));
}
