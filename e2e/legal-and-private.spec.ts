import sharp from "sharp";
import type { Locator } from "@playwright/test";
import { expect, login, newPage, test, USERS } from "./fixtures";

test("the footer links to the About, Contact, Terms and Privacy pages", async ({ page }) => {
    for (const [link, heading] of [["About", "About Vedev.Guru"], ["Contact", "Contact"], ["Terms", "Terms of use"], ["Privacy", "Privacy policy"]]) {
        await page.goto("/");
        await page.getByRole("contentinfo").getByRole("link", { name: link, exact: true }).click();
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Children" })).toBeVisible();
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "Grievance officer" })).toBeVisible();
});

test("sign-up asks for confirmation of age 18+ and acceptance of the terms", async ({ page }) => {
    await page.goto("/auth/register");
    const consent = page.getByRole("checkbox", { name: /I am 18 or older/ });
    await expect(consent).toHaveAttribute("required", "");
    await expect(page.getByRole("link", { name: "Terms of use" })).toHaveAttribute("href", "/terms");
});

test("a private post is visible only to its author, not to admins or the review queue", async ({ browser }) => {
    const title = `Private notes ${Date.now()}`;
    const slug = title.toLowerCase().replace(/\s+/g, "-");

    const authorPage = await newPage(browser);
    await login(authorPage, USERS.author.email, undefined, "/posts/add");
    await authorPage.getByLabel("Title").fill(title);
    const editor = authorPage.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially("Only for me.");
    await authorPage.getByRole("checkbox", { name: "Private: only I can see this post" }).check();
    await authorPage.getByRole("button", { name: "Save privately" }).click();
    await expect(authorPage).toHaveURL(/\/dashboard\/posts$/);
    await expect(authorPage.getByRole("row", { name: new RegExp(title) }).getByText("Private", { exact: true })).toBeVisible();

    await authorPage.goto(`/posts/${slug}`);
    await expect(authorPage.getByText("Private post: only you can see it.")).toBeVisible();

    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email, undefined, "/dashboard/admin/posts");
    await expect(adminPage.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(adminPage.getByRole("row", { name: new RegExp(title) })).toHaveCount(0);
    expect((await adminPage.goto(`/posts/${slug}`))?.status()).toBe(404);
    expect((await adminPage.goto(`/posts/${slug}/edit`))?.status()).toBe(200);
    await expect(adminPage.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

// A real 64x48 image, so a loaded <img> has a measurable size.
const testImage = () => sharp({ create: { width: 64, height: 48, channels: 3, background: "#3a7" } }).png().toBuffer();

// Whether an <img> finished loading real pixels (a refused request leaves naturalWidth at 0).
const loaded = (image: Locator) => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0);

test("a private post's banner and inline images reach only its author, and become public when it is shared", async ({ browser }) => {
    const title = `Private images ${Date.now()}`;
    const slug = title.toLowerCase().replace(/\s+/g, "-");

    const authorPage = await newPage(browser);
    await login(authorPage, USERS.author.email, undefined, "/posts/add");
    await authorPage.getByLabel("Title").fill(title);
    const editor = authorPage.locator('[contenteditable="true"]').first();
    await editor.click();
    await editor.pressSequentially("Pictures only I should see.");
    await authorPage.getByRole("checkbox", { name: "Private: only I can see this post" }).check();
    await authorPage.locator('input[type="file"][accept="image/*"]').first().setInputFiles({ name: "banner.png", mimeType: "image/png", buffer: await testImage() });
    // The editor's preview loads the uploaded file directly, so its src is the upload's address.
    const preview = authorPage.locator('img[src^="/uploads/"]').first();
    await expect(preview).toBeVisible();
    const banner = (await preview.getAttribute("src"))!;
    await expect.poll(() => loaded(preview)).toBe(true);
    await authorPage.getByRole("button", { name: "Save privately" }).click();
    await expect(authorPage).toHaveURL(/\/dashboard\/posts$/);

    // An inline image in the body, added through the same edit route the editor uses.
    const inlineUpload = await authorPage.request.post("/api/posts/upload", { multipart: { file: { name: "inline.png", mimeType: "image/png", buffer: await testImage() } } });
    const inline: string = (await inlineUpload.json()).location;
    const edit = await authorPage.request.patch(`/api/posts/${slug}`, {
        multipart: {
            title,
            slug,
            postBannerPath: banner,
            private: "true",
            post_data: JSON.stringify([{ type: "p", children: [{ text: "Pictures only I should see." }] }, { type: "img", url: inline, children: [{ text: "" }] }]),
        },
    });
    expect(edit.ok()).toBe(true);

    // The author sees both images on the post page, served privately.
    await authorPage.goto(`/posts/${slug}`);
    await expect(authorPage.getByText("Private post: only you can see it.")).toBeVisible();
    const bannerImage = authorPage.getByRole("article").locator(`img[src*="${banner.split("/").pop()}"]`).first();
    const inlineImage = authorPage.getByRole("article").locator(`img[src*="${inline.split("/").pop()}"]`).first();
    await expect.poll(() => loaded(bannerImage)).toBe(true);
    await expect.poll(() => loaded(inlineImage)).toBe(true);
    const own = await authorPage.request.get(banner);
    expect(own.status()).toBe(200);
    expect(own.headers()["cache-control"]).toBe("private, no-store");

    // The edit page's banner preview loads too.
    await authorPage.goto(`/posts/${slug}/edit`);
    await expect.poll(() => loaded(authorPage.locator(`img[src*="${banner.split("/").pop()}"]`).first())).toBe(true);

    // Nobody else gets the files: an admin, a logged-out visitor, or the image optimizer on their behalf.
    const adminPage = await newPage(browser);
    await login(adminPage, USERS.admin.email);
    const anonymous = await newPage(browser);
    for (const page of [adminPage, anonymous]) {
        for (const url of [banner, inline]) {
            expect((await page.request.get(url)).status()).toBe(404);
            // Every width next/image asks for, so a copy cached while the author worked would show up here.
            for (const width of [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840]) {
                expect((await page.request.get(`/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`)).ok()).toBe(false);
            }
        }
    }

    // The admin's Uploads page lists the files as "Private" without a preview, and won't download them.
    await adminPage.goto("/dashboard/admin/uploads?show=all");
    const bannerRow = adminPage.getByRole("row", { name: new RegExp(banner.split("/").pop()!.replace(".", "\\.")) });
    await expect(bannerRow.getByText("Private", { exact: true })).toBeVisible();
    await expect(bannerRow.locator("img")).toHaveCount(0);
    expect((await adminPage.request.get(`/api/uploads/download?url=${encodeURIComponent(banner)}`)).status()).toBe(404);

    // Shared again: the images are public once more.
    await authorPage.getByRole("checkbox", { name: "Private: only I can see this post" }).uncheck();
    await authorPage.getByRole("button", { name: "Save changes" }).click();
    await expect(authorPage).toHaveURL(/\/dashboard\/posts$/);
    await expect.poll(async () => (await anonymous.request.get(banner)).status()).toBe(200);
    expect((await anonymous.request.get(inline)).status()).toBe(200);
});
