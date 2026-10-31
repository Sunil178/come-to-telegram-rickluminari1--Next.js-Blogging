import fs from "fs";
import path from "path";
import { IMAGE_EXTENSIONS, uploadRoot, UPLOAD_URL_PREFIX } from "@/libs/uploads";

// next/image refuses unallowlisted hosts, so each Unsplash banner is fetched once and
// stored under uploads/ like a real upload, instead of allowlisting an external host.
const SEED_UPLOAD_DIR = path.join(uploadRoot(), "seed");
const SEED_URL_PREFIX = `${UPLOAD_URL_PREFIX}/seed`;
function findExistingSeedImage(slug: string): string | null {
    if (!fs.existsSync(SEED_UPLOAD_DIR)) return null;
    const match = fs.readdirSync(SEED_UPLOAD_DIR).find((file) => file.startsWith(`${slug}.`));
    return match ? `${SEED_URL_PREFIX}/${match}` : null;
}

export async function downloadSeedImage(url: string, slug: string): Promise<string> {
    const existing = findExistingSeedImage(slug);
    if (existing) return existing;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download seed image for ${slug}: ${response.status}`);

    const extension = IMAGE_EXTENSIONS[response.headers.get("content-type") || ""] || "jpg";
    fs.mkdirSync(SEED_UPLOAD_DIR, { recursive: true });
    const filename = `${slug}.${extension}`;
    fs.writeFileSync(path.join(SEED_UPLOAD_DIR, filename), Buffer.from(await response.arrayBuffer()));
    console.log(`🖼️  Downloaded banner image: ${slug}.${extension}`);
    return `${SEED_URL_PREFIX}/${filename}`;
}
