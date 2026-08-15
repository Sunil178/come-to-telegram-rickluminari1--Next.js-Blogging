import fs from "fs";
import path from "path";

// next/image refuses unallowlisted hosts, so each Unsplash banner is fetched once and
// stored under uploads/ like a real upload, instead of allowlisting an external host.
const SEED_UPLOAD_DIR = path.join("uploads", "seed");
const IMAGE_EXTENSIONS: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

function findExistingSeedImage(slug: string): string | null {
    if (!fs.existsSync(SEED_UPLOAD_DIR)) return null;
    const match = fs.readdirSync(SEED_UPLOAD_DIR).find((file) => file.startsWith(`${slug}.`));
    return match ? `/${SEED_UPLOAD_DIR}/${match}`.split(path.sep).join("/") : null;
}

export async function downloadSeedImage(url: string, slug: string): Promise<string> {
    const existing = findExistingSeedImage(slug);
    if (existing) return existing;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download seed image for ${slug}: ${response.status}`);

    const extension = IMAGE_EXTENSIONS[response.headers.get("content-type") || ""] || "jpg";
    fs.mkdirSync(SEED_UPLOAD_DIR, { recursive: true });
    const relativePath = path.join(SEED_UPLOAD_DIR, `${slug}.${extension}`);
    fs.writeFileSync(relativePath, Buffer.from(await response.arrayBuffer()));
    console.log(`🖼️  Downloaded banner image: ${slug}.${extension}`);
    return `/${relativePath}`.split(path.sep).join("/");
}
