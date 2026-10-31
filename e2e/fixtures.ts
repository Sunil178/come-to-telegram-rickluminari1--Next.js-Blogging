import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Passw0rd!";
export const USERS = {
    admin: { email: "e2e-admin@example.com", username: "e2e.admin", role: "admin" },
    author: { email: "e2e-author@example.com", username: "e2e.author", role: "author" },
    reader: { email: "e2e-reader@example.com", username: "e2e.reader", role: "reader" },
} as const;
export const SEEDED_POST = { slug: "e2e-welcome", title: "Welcome to the end-to-end suite" };
export const RELATED_POST = { slug: "e2e-related", title: "A related end-to-end post" };

export async function login(page: Page, email: string, password = PASSWORD, callbackUrl = "/posts") {
    await page.goto(`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page).toHaveURL(new RegExp(`${callbackUrl.replace(/[/?]/g, "\\$&")}$`));
}
