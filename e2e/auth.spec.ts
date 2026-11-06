import { expect, PASSWORD, test, USERS } from "./fixtures";

test("a wrong password is rejected with a clear message", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email").fill(USERS.reader.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
});

test("gated pages redirect a logged-out visitor to login and back", async ({ page }) => {
    await page.goto("/dashboard/posts");
    await expect(page).toHaveURL(/\/auth\/login\?callbackUrl=%2Fdashboard%2Fposts/);
    await page.getByLabel("Email").fill(USERS.author.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard\/posts$/);
});

test("pages carry a nonce CSP and render without CSP violations", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
        if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
    });
    const response = await page.goto("/");
    expect(response?.headers()["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    await page.goto("/posts");
    expect(violations).toEqual([]);
});
