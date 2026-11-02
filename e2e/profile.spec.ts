import { existsSync } from "node:fs";
import { type Browser } from "@playwright/test";
import { APPLICATION, expect, login, newPage, PASSWORD, presetConsent, test, USERS } from "./fixtures";
import { createUser, withDb } from "./db";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const GEOIP = existsSync("data/geoip/dbip-city-lite.mmdb");

// A browser whose requests arrive "from" a public address, as they would through the trusted proxy.
async function pageFrom(browser: Browser, ip: string) {
    const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
    await presetConsent(context, test.info().project.use.baseURL);
    return context.newPage();
}

test("a user fills in their profile; the public part shows on their author page and the private part doesn't", async ({ page }) => {
    const user = await createUser(`e2e.profiled${Date.now()}`);
    await login(page, user.email, undefined, "/dashboard/account");
    const form = page.getByRole("form", { name: "Profile" });

    await form.getByLabel("Headline").fill("Writes about databases");
    await form.getByLabel("Bio").fill("Ten years of Postgres and MongoDB.");
    await form.getByLabel("Country").fill("India");
    await form.getByLabel("City").fill("Pune");
    await form.getByLabel("Website").fill("not a website");
    await form.getByLabel("Expertise").fill("databases, indexing");
    await form.getByLabel("Phone").fill("+91 98765 43210");
    await form.getByLabel("Date of birth").fill("1990-05-17");
    // The browser checks the url field before sending; the server has its own check for the rest.
    await form.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toHaveCount(0);
    await form.getByLabel("Website").fill("https://db.example");
    await form.getByLabel("Other links").fill("https://github.com/example\nftp://bad.example");
    await form.getByRole("button", { name: "Save profile" }).click();
    await expect(form.getByRole("alert")).toContainText("Links must be full web addresses");
    await form.getByLabel("Other links").fill("https://github.com/example");
    await form.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.getByLabel("Profile photo").setInputFiles({ name: "me.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByText("Photo updated.")).toBeVisible();

    // A fresh tab, not a reload or a navigation: either would race the page's own refresh after the upload.
    const fresh = await page.context().newPage();
    await fresh.goto("/dashboard/account");
    const saved = fresh.getByRole("form", { name: "Profile" });
    await expect(saved.getByLabel("City")).toHaveValue("Pune");
    await expect(saved.getByLabel("Phone")).toHaveValue("+91 98765 43210");
    await expect(saved.getByLabel("Date of birth")).toHaveValue("1990-05-17");

    await fresh.goto(`/users/${user.username}`);
    await expect(fresh.getByText("Writes about databases")).toBeVisible();
    await expect(fresh.getByText("Pune, India")).toBeVisible();
    await expect(fresh.getByRole("link", { name: "db.example" })).toHaveAttribute("rel", /nofollow/);
    await expect(fresh.getByRole("list", { name: "Expertise and topics" }).getByText("indexing")).toBeVisible();
    await expect(fresh.getByText("98765")).toHaveCount(0);
    await expect(fresh.getByText("1990")).toHaveCount(0);
    expect(await fresh.locator("main img").first().getAttribute("src")).toMatch(/^\/uploads\//);
});

test("a user changes their password, is signed out, and only the new password works", async ({ browser }) => {
    const user = await createUser(`e2e.changer${Date.now()}`);
    const page = await newPage(browser);
    await login(page, user.email, undefined, "/dashboard/account");
    const form = page.getByRole("form", { name: "Change password" });
    await form.getByLabel("Current password").fill("wrong-password");
    await form.getByLabel("New password", { exact: true }).fill("brand-new-pass");
    await form.getByLabel("Confirm new password").fill("brand-new-pass");
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(form.getByRole("alert")).toHaveText("Your current password isn't correct.");

    await form.getByLabel("Current password").fill(PASSWORD);
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(page).toHaveURL(/\/auth\/login\?passwordChanged=1/);
    await expect(page.getByText("Password changed. Log in with your new password.")).toBeVisible();

    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await login(page, user.email, "brand-new-pass", "/dashboard/account");
    await expect(page).toHaveURL(/\/dashboard\/account/);
    await page.context().close();
});

test("an applicant's form saves to their profile, and the admin reviews the full application with addresses before approving", async ({ browser }) => {
    test.setTimeout(120_000);
    const reader = await createUser(`e2e.applicant${Date.now()}`);
    await withDb((db) => db.collection("users").updateOne({ _id: reader.id }, { $set: { "profile.topics": ["performance"], "privateDetails.phone": "+1 555 0100" } }));

    // Signs in and applies "from" a Google public DNS address, a stable, well-known US location.
    const readerPage = await pageFrom(browser, "8.8.8.8");
    await login(readerPage, reader.email, undefined, "/dashboard/posts");
    await readerPage.getByRole("button", { name: "Request to publish" }).click();
    const dialog = readerPage.getByRole("dialog");
    await expect(dialog.getByLabel("Topics you'd write about")).toHaveValue("performance");
    await dialog.getByLabel("Topics you'd write about").fill("performance, caching");
    await dialog.getByLabel("Links to past work").fill("https://blog.example/caching");
    await dialog.getByLabel("Why do you want to write here?").fill(APPLICATION.motivation);
    await dialog.getByLabel("Writing sample").fill(APPLICATION.sample);
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(readerPage.getByText("Request sent — an admin will review it.")).toBeVisible();

    await readerPage.goto("/dashboard/account");
    await expect(readerPage.getByRole("form", { name: "Profile" }).getByLabel("Topics you write about")).toHaveValue("performance, caching");

    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/admin/requests");
    const row = adminPage.getByRole("row").filter({ hasText: reader.email });
    if (GEOIP) await expect(row).toContainText("United States");
    await row.getByRole("link", { name: reader.email }).click();
    await expect(adminPage.getByRole("heading", { name: "Temp E2E" })).toBeVisible();

    const application = adminPage.getByRole("region", { name: "Application" });
    await expect(application).toContainText(APPLICATION.motivation);
    await expect(application).toContainText("Caching is the cheapest performance win");
    await expect(application).toContainText("8.8.8.8");
    const addresses = adminPage.getByRole("region", { name: "Addresses" });
    await expect(addresses).toContainText("8.8.8.8");
    if (GEOIP) await expect(addresses).toContainText("United States");
    await expect(adminPage.getByRole("region", { name: "Public profile" })).toContainText("performance, caching");
    await expect(adminPage.getByRole("region", { name: "Private details" })).toContainText("+1 555 0100");
    await expect(adminPage.getByRole("region", { name: "Account and activity" })).toContainText("Verified");

    await adminPage.getByRole("button", { name: "Approve request" }).click();
    await expect(adminPage.getByText("Request approved — user is now an Author.")).toBeVisible();
    await expect(adminPage.getByText(/^Approved/)).toBeVisible();
    await expect(adminPage.getByRole("button", { name: "Approve request" })).toHaveCount(0);
    await readerPage.context().close();
    await adminPage.context().close();
});

test("only admins can open an applicant's review page", async ({ page }) => {
    const reader = await createUser(`e2e.private${Date.now()}`);
    const requestId = await withDb(async (db) => (await db.collection("publishrequests").insertOne({ userId: reader.id, status: "Pending", createdAt: new Date(), updatedAt: new Date() })).insertedId);
    await login(page, USERS.author.email, undefined, "/dashboard/posts");
    await page.goto(`/dashboard/admin/requests/${requestId}`);
    await expect(page).toHaveURL(/\/dashboard\/posts$/);
});
