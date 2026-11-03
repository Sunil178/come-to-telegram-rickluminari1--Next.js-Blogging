import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { withApiGuard } from "@/libs/api-guard";
import { resolveUploadPath, UPLOAD_CONTENT_TYPES } from "@/libs/uploads";

interface RouteContext {
    params: Promise<{ path: string[] }>;
}

const notFound = () => NextResponse.json({ data: null, message: "Not found" }, { status: 404 });

// Upload-route files are named <uuid>.<ext> and never rewritten; seed banners (named by slug) can be.
const IMMUTABLE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z]+$/;

// Serves files from the upload directory (UPLOAD_DIR), so uploads work wherever that directory is
// mounted instead of depending on a symlink inside public/.
export const GET = withApiGuard<RouteContext>(
    async (request, { params }) => {
        const filePath = resolveUploadPath((await params).path);
        if (!filePath) return notFound();

        let stats: fs.Stats;
        try {
            stats = await fs.promises.stat(filePath);
        } catch {
            return notFound();
        }
        if (!stats.isFile()) return notFound();

        const body = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream<Uint8Array>;
        return new Response(body, {
            headers: {
                "Content-Type": UPLOAD_CONTENT_TYPES[path.extname(filePath).toLowerCase()],
                "Content-Length": String(stats.size),
                "Cache-Control": IMMUTABLE_NAME.test(path.basename(filePath))
                    ? "public, max-age=31536000, immutable"
                    : "public, max-age=3600",
            },
        });
    },
    { auth: false }
);
