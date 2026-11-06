import { type Page } from "@playwright/test";
import { expect, login, newPage, PASSWORD, test } from "./fixtures";
import { createUser } from "./db";
import { linkFromLatestEmail, messagesTo } from "./mailpit";

async function register(page: Page, id: string) {
    await page.goto("/auth/register");
    await page.getByLabel("Username").fill(`newbie${id}`);
    await page.getByLabel("First Name").fill("New");
    await page.getByLabel("Last Name").fill("Reader");
    await page.getByLabel("Email").fill(`newbie${id}@example.com`);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#password_confirmation").fill(PASSWORD);
    await page.getByRole("checkbox", { name: /I am 18 or older/ }).check();
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?registered=verify$/);
    return `newbie${id}@example.com`;
}

async function submitLogin(page: Page, email: string, password = PASSWORD) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
}

test("a new account confirms its email before it can sign in", async ({ page, request }) => {
    const email = await register(page, `${Date.now()}`);
    await expect(page.getByText("We've emailed you a link to confirm your address")).toBeVisible();

    await submitLogin(page, email);
    await expect(page.getByText("Please confirm your email address before logging in")).toBeVisible();
    await page.getByRole("button", { name: "Resend confirmation email" }).click();
    await expect(page.getByText("a new confirmation link is on its way")).toBeVisible();

    // The resent link replaces the first one, so only the newest email works.
    const link = await linkFromLatestEmail(request, email, /Confirm your email/, 2);
    await page.goto(link);
    await page.getByRole("button", { name: "Confirm my email" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?verified=1$/);
    await expect(page.getByText("Email confirmed")).toBeVisible();

    await login(page, email);
    await expect(page.getByRole("button", { name: "Notifications" })).toBeVisible();

    await page.goto(link);
    await page.getByRole("button", { name: "Confirm my email" }).click();
    await expect(page.getByText("This confirmation link is invalid or has expired")).toBeVisible();
});

test("a forgotten password is reset through a one-time emailed link", async ({ page, request }) => {
    const email = await register(page, `${Date.now()}r`);

    // The login page has an "Email" field too and stays until the new page arrives.
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByText("Forgot your password?", { exact: true })).toBeVisible();
    await expect(page).toHaveTitle("Forgot password — Vedev.Guru");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account uses that email, a password reset link is on its way")).toBeVisible();

    const link = await linkFromLatestEmail(request, email, /Reset your/);
    await page.goto(link);
    await page.locator("#password").fill("brand-new-pass");
    await page.locator("#password_confirmation").fill("brand-new-pass");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?reset=1$/);

    await submitLogin(page, email, PASSWORD);
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    // Resetting through the emailed link also confirms the address, so no verification step remains.
    await login(page, email, "brand-new-pass");
    await expect(page.getByRole("button", { name: "Notifications" })).toBeVisible();

    await page.goto(link);
    await page.locator("#password").fill("another-pass");
    await page.locator("#password_confirmation").fill("another-pass");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page.getByText("This reset link is invalid, expired or already used")).toBeVisible();
});

test("a reset request for an unknown email looks the same and sends nothing", async ({ page, request }) => {
    const email = `nobody${Date.now()}@example.com`;
    await page.goto("/auth/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText("If an account uses that email, a password reset link is on its way")).toBeVisible();

    // eslint-disable-next-line no-restricted-properties -- Checks that no email is sent: nothing to wait for.
    await page.waitForTimeout(1_000);
    expect(await messagesTo(request, email)).toHaveLength(0);
});

test("a password reset signs the account out of its other browsers", async ({ browser, page, request }) => {
    test.setTimeout(150_000);
    const user = await createUser(`e2e.resetter${Date.now()}`);
    const otherBrowser = await newPage(browser);
    await login(otherBrowser, user.email, undefined, "/dashboard/notifications");

    await page.goto("/auth/forgot-password");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await page.goto(await linkFromLatestEmail(request, user.email, /Reset your/));
    await page.locator("#password").fill("a-fresh-password");
    await page.locator("#password_confirmation").fill("a-fresh-password");
    await page.getByRole("button", { name: "Set new password" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?reset=1$/);

    // Sessions re-check the account at most once a minute.
    await expect.poll(async () => {
        await otherBrowser.goto("/dashboard/notifications");
        return new URL(otherBrowser.url()).pathname;
    }, { timeout: 90_000, intervals: [5_000] }).toBe("/auth/login");
    await otherBrowser.context().close();
});
