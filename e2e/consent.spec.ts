import { expect, test as base } from "@playwright/test";
import mongoose from "mongoose";
import { login, SEEDED_POST, USERS } from "./fixtures";

// Uses the plain Playwright test: these browsers start without a stored consent choice.
const test = base;
const E2E_MONGODB_URI = process.env.E2E_MONGODB_URI ?? process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/blog_e2e";

async function eventsFor(visitorId: string) {
    const connection = await mongoose.createConnection(E2E_MONGODB_URI).asPromise();
    try {
        return await connection.collection("visitor_events").find({ visitorId }).toArray();
    } finally {
        await connection.close();
    }
}

test("accepting consent records reads and stitches them to the account at sign-in", async ({ page, context }) => {
    await page.goto(`/posts/${SEEDED_POST.slug}`);
    const banner = page.getByRole("dialog", { name: "Cookie consent" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Accept" }).click();
    await expect(banner).toHaveCount(0);

    const visitorId = (await context.cookies()).find((cookie) => cookie.name === "vid");
    expect(visitorId?.httpOnly).toBe(true);

    // The banner choice is made after the first view was counted, so read the post again on a fresh dedupe key.
    await context.clearCookies({ name: `viewed:${SEEDED_POST.slug}` });
    await page.reload();
    await expect.poll(async () => (await eventsFor(visitorId!.value)).length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect((await eventsFor(visitorId!.value))[0].userId).toBeNull();

    await login(page, USERS.reader.email);
    await expect.poll(async () => (await eventsFor(visitorId!.value))[0].userId?.toString() ?? null).not.toBeNull();
    await expect(page.getByRole("dialog", { name: "Cookie consent" })).toHaveCount(0);
});

test("declining sets no visitor cookie and records nothing, and the choice can be changed later", async ({ page, context }) => {
    await page.goto("/");
    await page.getByRole("dialog", { name: "Cookie consent" }).getByRole("button", { name: "Decline" }).click();
    await page.goto(`/posts/${SEEDED_POST.slug}`);
    await expect(page.getByRole("dialog", { name: "Cookie consent" })).toHaveCount(0);
    expect((await context.cookies()).find((cookie) => cookie.name === "vid")).toBeUndefined();

    await page.goto("/");
    await page.getByRole("button", { name: "Cookie preferences" }).click();
    await expect(page.getByRole("dialog", { name: "Cookie consent" })).toBeVisible();
});
