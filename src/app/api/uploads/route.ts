import { NextResponse } from "next/server";
import { withApiGuard } from "@/libs/api-guard";
import { ROLES } from "@/libs/roles";
import { deleteUnusedUploads } from "@/libs/upload-cleanup";

const MAX_URLS = 1000;

// Admin cleanup: deletes the chosen unused files (or every unused one); files in use or under a day old are kept.
export const DELETE = withApiGuard(async (request) => {
    const body = await request.json().catch(() => null);
    let urls: string[] | "all";
    if (body?.all === true) {
        urls = "all";
    } else if (Array.isArray(body?.urls) && body.urls.length > 0 && body.urls.length <= MAX_URLS && body.urls.every((url: unknown) => typeof url === "string")) {
        urls = body.urls;
    } else {
        return NextResponse.json({ data: null, message: "Choose the files to delete" }, { status: 400 });
    }
    const result = await deleteUnusedUploads(urls);
    return NextResponse.json({ data: result, message: `Deleted ${result.deleted.length} file${result.deleted.length === 1 ? "" : "s"}` });
}, { role: ROLES.ADMIN });
