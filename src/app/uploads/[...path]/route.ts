import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import Upload, { type UploadAccess } from "@/models/Upload";
import { getSession, withApiGuard } from "@/libs/api-guard";
import { resolveUploadPath, uploadRoot, UPLOAD_CONTENT_TYPES, UPLOAD_URL_PREFIX } from "@/libs/uploads";

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

        // A private post's image goes to its uploader alone; neither it nor a draft's image is kept by shared caches.
        const url = `${UPLOAD_URL_PREFIX}/${path.relative(uploadRoot(), filePath).split(path.sep).join("/")}`;
        const record = await Upload.findOne({ url, access: { $in: ["draft", "private"] } }).select("userId access").lean<{ userId: { toString(): string }; access: UploadAccess }>();
        if (record?.access === "private" && record.userId.toString() !== (await getSession())?.user?.id) return notFound();

        const body = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream<Uint8Array>;
        return new Response(body, {
            headers: {
                "Content-Type": UPLOAD_CONTENT_TYPES[path.extname(filePath).toLowerCase()],
                "Content-Length": String(stats.size),
                "Cache-Control": record?.access === "private"
                    ? "private, no-store"
                    : record?.access === "draft"
                      ? "private, max-age=3600"
                      : IMMUTABLE_NAME.test(path.basename(filePath))
                      ? "public, max-age=31536000, immutable"
                      : "public, max-age=3600",
            },
        });
    },
    { auth: false }
);
