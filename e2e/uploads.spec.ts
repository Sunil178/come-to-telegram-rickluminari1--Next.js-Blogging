import { utimes } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { unzipSync } from "fflate";
import type { Page } from "@playwright/test";
import { expect, login, newPage, test, USERS } from "./fixtures";
import { createPost, withDb } from "./db";

// 1x1 transparent PNG.
const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64"
);

test("an author's uploaded image is served back from /uploads", async ({ page }) => {
    await login(page, USERS.author.email);
    const upload = await page.request.post("/api/posts/upload", {
        multipart: { file: { name: "pixel.png", mimeType: "image/png", buffer: PNG } },
    });
    expect(upload.ok()).toBe(true);
    const { location } = await upload.json();
    expect(location).toMatch(/^\/uploads\/\d{4}-\d{1,2}-\d{1,2}\/[0-9a-f-]+\.png$/);

    const served = await page.request.get(location);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/png");
    expect(await sharp(await served.body()).metadata()).toMatchObject({ format: "png", width: 1, height: 1 });

    // Encoded slashes reach the route decoded, so this asks for a real image outside the upload
    // root (UPLOAD_DIR sits next to public/) that only the traversal check can refuse.
    expect((await page.request.get(location.replace(/\/(?=[^/]+$)/, "%2f"))).status()).toBe(200);
    expect((await page.request.get("/uploads/..%2fpublic%2fassets%2fimages%2fno-image.webp")).status()).toBe(404);
});

// A camera photo that says where it was taken.
const photoWithGps = () =>
    sharp({ create: { width: 64, height: 48, channels: 3, background: "#39c" } })
        .jpeg()
        .withMetadata({ exif: { IFD0: { Make: "Canon", Model: "EOS R5" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "18/1 31/1 12/1", GPSLongitudeRef: "E", GPSLongitude: "73/1 51/1 0/1" } } })
        .toBuffer();

async function upload(page: Page, name: string, mimeType: string, buffer: Buffer): Promise<string> {
    const response = await page.request.post("/api/posts/upload", { multipart: { file: { name, mimeType, buffer } } });
    expect(response.ok()).toBe(true);
    return (await response.json()).location;
}

test("a photo's location never reaches readers; its metadata stays private with the upload record", async ({ page }) => {
    await login(page, USERS.author.email);
    const location = await upload(page, "holiday.jpg", "image/jpeg", await photoWithGps());

    const served = await page.request.get(location);
    expect((await sharp(await served.body()).metadata()).exif).toBeUndefined();

    const record = await withDb((db) => db.collection("uploads").findOne({ url: location }));
    expect(record).toMatchObject({ purpose: "post", mimeType: "image/jpeg", width: 64, height: 48, metadata: { make: "Canon", model: "EOS R5" } });
    expect(record?.metadata.gps.latitude).toBeCloseTo(18.52, 2);
});

// Cleanup keeps unused files under a day old (they may be in a post being written), so age them.
async function makeOld(url: string) {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await utimes(path.join(".e2e-uploads", url.replace("/uploads/", "")), twoDaysAgo, twoDaysAgo);
}

test("an admin reviews unused uploads, downloads one or several, and deletes them one at a time or by selection", async ({ browser }) => {
    const authorPage = await newPage(browser);
    await login(authorPage, USERS.author.email);
    const photo = await upload(authorPage, "photo.jpg", "image/jpeg", await photoWithGps());
    const orphan = await upload(authorPage, "orphan.png", "image/png", PNG);
    const banner = await upload(authorPage, "banner.png", "image/png", PNG);
    const fresh = await upload(authorPage, "fresh.png", "image/png", PNG);
    for (const url of [photo, orphan, banner]) await makeOld(url);
    const authorId = await withDb(async (db) => (await db.collection("users").findOne({ email: USERS.author.email }))!._id);
    await createPost(authorId, { bannerImage: banner });

    // Readers and authors can't open the report or use its endpoints.
    expect((await authorPage.request.delete("/api/uploads", { data: { urls: [orphan] } })).status()).toBe(403);
    await authorPage.goto("/dashboard/admin/uploads");
    await expect(authorPage).toHaveURL(/\/dashboard\/posts/);
    await authorPage.context().close();

    const page = await newPage(browser);
    await login(page, USERS.admin.email, undefined, "/dashboard/admin/uploads");
    await expect(page.getByRole("heading", { name: "Uploads" })).toBeVisible();
    const row = (url: string) => page.getByRole("row").filter({ hasText: url });
    await expect(row(photo)).toContainText("Unused");
    await expect(row(orphan)).toContainText(`by ${USERS.author.username}`);
    await expect(row(banner)).toHaveCount(0);
    await expect(row(fresh)).toContainText("New");
    await expect(row(fresh).getByRole("button", { name: `Delete ${fresh}` })).toBeDisabled();

    await row(photo).getByText("Details").click();
    await expect(row(photo)).toContainText("Canon EOS R5");
    await expect(row(photo)).toContainText("18.52000, 73.85000");

    const single = page.waitForEvent("download");
    await row(orphan).getByRole("link", { name: `Download ${orphan}` }).click();
    expect((await single).suggestedFilename()).toBe(orphan.split("/").pop());

    await row(photo).getByRole("checkbox").click();
    await row(orphan).getByRole("checkbox").click();
    const zip = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download selected (2)" }).click();
    const archive = await zip;
    expect(archive.suggestedFilename()).toMatch(/^uploads-\d{4}-\d{2}-\d{2}\.zip$/);
    const entries = unzipSync(new Uint8Array(await (await import("node:fs/promises")).readFile((await archive.path())!)));
    expect(Object.keys(entries).sort()).toEqual([photo, orphan].map((url) => url.replace("/uploads/", "")).sort());

    await row(orphan).getByRole("button", { name: `Delete ${orphan}` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Deleted 1 file.")).toBeVisible();
    await expect(row(orphan)).toHaveCount(0);
    expect((await page.request.get(orphan)).status()).toBe(404);

    // The used banner shows under All, and can't be deleted.
    await page.getByRole("navigation", { name: "Which files" }).getByRole("link", { name: /^All/ }).click();
    await expect(row(banner)).toContainText("In use");
    await expect(row(banner).getByRole("button", { name: `Delete ${banner}` })).toBeDisabled();
    await row(banner).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Delete selected (1)" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Deleted 0 files. Kept 1 in use.")).toBeVisible();
    expect((await page.request.get(banner)).status()).toBe(200);

    await page.getByRole("navigation", { name: "Which files" }).getByRole("link", { name: /^Unused/ }).click();
    await expect(page.getByText("Deleted 1 file.")).toHaveCount(0);
    await row(photo).getByRole("checkbox").click();
    await page.getByRole("button", { name: "Delete selected (1)" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Deleted 1 file.")).toBeVisible();
    await expect(row(photo)).toHaveCount(0);
    // The records stay, marked removed and without the photo metadata, so the day's upload count holds.
    const records = await withDb((db) => db.collection("uploads").find({ url: { $in: [photo, orphan] } }).toArray());
    expect(records.map((record) => [record.removedAt instanceof Date, record.metadata ?? null])).toEqual([[true, null], [true, null]]);
});
