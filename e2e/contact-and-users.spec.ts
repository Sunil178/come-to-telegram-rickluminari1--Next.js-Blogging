import { createUser, withDb } from "./db";
import { expect, expectNotification, login, newPage, SEEDED_POST, test, USERS } from "./fixtures";
import { messagesTo } from "./mailpit";

test("a visitor reports a post through the contact form, gets a reference by email, and an admin resolves it", async ({ page, browser, request }) => {
    const email = `reporter${Date.now()}@example.com`;
    await page.goto(`/posts/${SEEDED_POST.slug}`);
    await page.getByRole("link", { name: "Report it" }).click();

    const form = page.getByRole("form", { name: "Contact form" });
    await expect(form.getByLabel("What is it about?")).toHaveValue("report");
    await expect(form.getByLabel("Link to the post, comment or image")).toHaveValue(new RegExp(`/posts/${SEEDED_POST.slug}$`));
    await form.getByLabel("Your name").fill("Asha Reporter");
    await form.getByLabel("Your email").fill(email);
    await form.getByLabel("Message").fill("This post copies a paragraph from my blog without credit.");
    await form.getByRole("button", { name: "Send message" }).click();
    const confirmation = page.getByRole("status").filter({ hasText: "Your reference is" });
    await expect(confirmation).toBeVisible();
    const reference = (await confirmation.locator("strong").innerText()).trim();
    expect(reference).toMatch(/^C-[A-Z0-9]{8}$/);

    // The acknowledgement carries the reference but never the message text.
    await expect.poll(async () => (await messagesTo(request, email)).map((message) => message.Subject), { timeout: 10_000 }).toContain(`We received your message (${reference})`);

    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/admin/messages");
    const item = adminPage.getByRole("listitem", { name: `Message ${reference}` });
    await expect(item).toContainText("Report a post, comment or image");
    await expect(item).toContainText("This post copies a paragraph");
    await expect(item.getByRole("link", { name: email })).toHaveAttribute("href", new RegExp(`^mailto:${email}`));
    await item.getByRole("button", { name: "Mark resolved" }).click();
    await expect(adminPage.getByText("Marked resolved.")).toBeVisible();
    await expect(item).toHaveCount(0);
    await adminPage.getByRole("link", { name: /^Resolved/ }).click();
    await expect(adminPage.getByRole("listitem", { name: `Message ${reference}` })).toContainText("Resolved");
    await expectNotification(adminPage, "Someone wrote through the contact form");

    // Only admins read messages.
    const readerPage = await newPage(browser);
    await login(readerPage, USERS.reader.email);
    await readerPage.goto("/dashboard/admin/messages");
    await expect(readerPage).toHaveURL(/\/dashboard\/posts/);
    await adminPage.context().close();
    await readerPage.context().close();
});

test("a signed-in reader's name and email are filled in, and the form explains what it needs", async ({ browser }) => {
    const page = await newPage(browser);
    await login(page, USERS.reader.email, undefined, "/contact");
    const form = page.getByRole("form", { name: "Contact form" });
    await expect(form.getByLabel("Your email")).toHaveValue(USERS.reader.email);
    await form.getByLabel("What is it about?").selectOption("question");
    await expect(form.getByLabel("Link (optional)")).not.toHaveAttribute("required", "");
    await form.getByLabel("What is it about?").selectOption("copyright");
    await expect(form.getByLabel("Link to the post, comment or image")).toHaveAttribute("required", "");
    await page.context().close();
});

test("an admin opens a user from the list and sees every detail, private ones included", async ({ browser }) => {
    const user = await createUser(`e2e.details${Date.now()}`);
    await withDb((db) => db.collection("users").updateOne({ _id: user.id }, { $set: {
        profile: { headline: "Writes about databases", city: "Pune", country: "India" },
        privateDetails: { dateOfBirth: new Date("1995-04-10T00:00:00Z"), gender: "Female", phone: "+91 98220 00000", address: "Baner, Pune" },
    } }));
    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/admin/users");
    await adminPage.getByLabel("Search users").fill(user.username);
    await expect(adminPage.getByRole("row")).toHaveCount(2);
    await adminPage.getByRole("link", { name: user.username }).click();

    await expect(adminPage.getByRole("heading", { level: 1, name: "Temp E2E" })).toBeVisible();
    const privateDetails = adminPage.getByRole("region", { name: "Private details" });
    await expect(privateDetails).toContainText("born 1995-04-10");
    await expect(privateDetails).toContainText("Female");
    await expect(privateDetails).toContainText("+91 98220 00000");
    await expect(adminPage.getByRole("region", { name: "Public profile" })).toContainText("Pune, India");
    await expect(adminPage.getByRole("region", { name: "Account and activity" })).toContainText(user.email);

    // From the public profile, admins get a way back to these details; others don't.
    await adminPage.getByRole("link", { name: "Public profile" }).click();
    await expect(adminPage.getByRole("link", { name: "All account details (admin only)" })).toBeVisible();
    const readerPage = await newPage(browser);
    await login(readerPage, USERS.reader.email);
    await readerPage.goto(`/users/${user.username}`);
    await expect(readerPage.getByRole("heading", { level: 1, name: user.username })).toBeVisible();
    await expect(readerPage.getByText("All account details")).toHaveCount(0);
    await expect(readerPage.getByText("+91 98220 00000")).toHaveCount(0);
    await adminPage.context().close();
    await readerPage.context().close();
});

test("gender is picked from a list and the date picker only offers dates for people 18 or older", async ({ browser }) => {
    const user = await createUser(`e2e.profilefields${Date.now()}`);
    const page = await newPage(browser);
    await login(page, user.email, undefined, "/dashboard/account");
    const gender = page.getByLabel("Gender").filter({ visible: true });
    await expect(gender.locator("option")).toHaveText(["Not specified", "Female", "Male", "Non-binary", "Prefer not to say"]);
    const latest = new Date();
    latest.setUTCFullYear(latest.getUTCFullYear() - 18);
    await expect(page.getByLabel("Date of birth").filter({ visible: true })).toHaveAttribute("max", latest.toISOString().slice(0, 10));

    await gender.selectOption("Non-binary");
    await page.getByLabel("Date of birth").filter({ visible: true }).fill("1999-12-31");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Gender").filter({ visible: true })).toHaveValue("Non-binary");

    // The server holds the same rules for anyone bypassing the form.
    const typed = await page.request.patch("/api/account/profile", { data: { gender: "anything typed" } });
    expect(typed.status()).toBe(400);
    const tooYoung = await page.request.patch("/api/account/profile", { data: { dateOfBirth: new Date().toISOString().slice(0, 10) } });
    expect(tooYoung.status()).toBe(400);
    await page.context().close();
});
