import { expect, test } from "@playwright/test";
import { login, USERS } from "./fixtures";

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
    expect(Buffer.from(await served.body()).equals(PNG)).toBe(true);

    // Encoded slashes reach the route decoded, so this asks for a real image outside the upload
    // root (UPLOAD_DIR sits next to public/) that only the traversal check can refuse.
    expect((await page.request.get(location.replace(/\/(?=[^/]+$)/, "%2f"))).status()).toBe(200);
    expect((await page.request.get("/uploads/..%2fpublic%2fassets%2fimages%2fno-image.webp")).status()).toBe(404);
});
