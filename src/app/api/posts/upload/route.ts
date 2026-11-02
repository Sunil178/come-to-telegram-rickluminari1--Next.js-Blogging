import { NextResponse } from "next/server";
import { withApiGuard } from "@/libs/api-guard";
import { ROLES } from "@/libs/roles";
import { logger } from "@/libs/logger";
import { saveUploadedImage } from "@/libs/image-upload";

export const POST = withApiGuard(async (request) => {
    try {
        if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
            return NextResponse.json({ data: null, location: null, message: "Invalid request type" }, { status: 400 });
        }

        const saved = await saveUploadedImage((await request.formData()).get("file"));
        if (!saved.ok) {
            return NextResponse.json({ data: null, location: null, message: saved.message }, { status: 400 });
        }
        return NextResponse.json({ data: saved.url, location: saved.url, message: "Success" });
    } catch (error) {
        logger.error("Failed to upload file", { error });
        return NextResponse.json({ data: null, location: null, message: "Something went wrong" }, { status: 500 });
    }
}, { role: ROLES.AUTHOR });
