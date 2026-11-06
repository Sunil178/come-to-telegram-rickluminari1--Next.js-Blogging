import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { Zip, ZipPassThrough } from "fflate";
import { NextResponse } from "next/server";
import { withApiGuard } from "@/libs/api-guard";
import { ROLES } from "@/libs/roles";
import { UPLOAD_CONTENT_TYPES, UPLOAD_URL_PREFIX } from "@/libs/uploads";
import { listUploads, uploadFiles } from "@/libs/upload-cleanup";
import Upload from "@/models/Upload";

const MAX_URLS = 1000;

// One file per pull, so only the file being sent sits in memory, however many are in the zip.
function zipStream(files: { url: string; target: string }[]): ReadableStream<Uint8Array> {
    const queue = [...files];
    let zip: Zip;
    return new ReadableStream({
        start(controller) {
            zip = new Zip((error, chunk, final) => {
                if (error) return controller.error(error);
                controller.enqueue(chunk);
                if (final) controller.close();
            });
        },
        async pull() {
            const next = queue.shift();
            if (!next) return zip.end();
            // Images are already compressed, so entries are stored as they are.
            const entry = new ZipPassThrough(next.url.slice(UPLOAD_URL_PREFIX.length + 1));
            zip.add(entry);
            const data = await fs.promises.readFile(next.target).catch((error) => (error.code === "ENOENT" ? null : Promise.reject(error)));
            entry.push(data ?? new Uint8Array(), true);
        },
    });
}

// Admin download of uploads: ?url=… (repeatable) for chosen files, ?scope=unused for every file
// "Delete all unused" would remove. One file comes back as itself, several as a zip.
export const GET = withApiGuard(async (request) => {
    const params = request.nextUrl.searchParams;
    const urls = params.get("scope") === "unused"
        ? (await listUploads()).filter((file) => !file.used && !file.recent).map((file) => file.url)
        : params.getAll("url").slice(0, MAX_URLS);
    // A private post's images stay with their uploader, admins included; checked on the canonical address.
    const candidates = uploadFiles(urls);
    const privateUrls = new Set<string>(await Upload.distinct("url", { url: { $in: candidates.map((file) => file.url) }, access: "private" }));
    const files = candidates.filter(({ url, target }) => !privateUrls.has(url) && fs.existsSync(target));
    if (files.length === 0) return NextResponse.json({ data: null, message: "No files to download" }, { status: 404 });

    if (files.length === 1) {
        const [{ target }] = files;
        return new Response(Readable.toWeb(fs.createReadStream(target)) as ReadableStream<Uint8Array>, {
            headers: {
                "Content-Type": UPLOAD_CONTENT_TYPES[path.extname(target).toLowerCase()],
                "Content-Disposition": `attachment; filename="${path.basename(target).replace(/[^\w.-]/g, "_")}"`,
                "Cache-Control": "no-store",
            },
        });
    }
    const date = new Date().toISOString().slice(0, 10);
    return new Response(zipStream(files), {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="uploads-${date}.zip"`,
            "Cache-Control": "no-store",
        },
    });
}, { role: ROLES.ADMIN });
