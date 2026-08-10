import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { withApiGuard } from "@/libs/api-guard";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Extension is derived from this allowlist, never from the client-supplied filename.
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};

export const POST = withApiGuard(async (request) => {
    try {
        if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
            return NextResponse.json({ data: null, location: null, message: "Invalid request type" }, { status: 400 });
        }

        const formData = await request.formData();
        const file = (formData.get("file") as Blob) || null;

        if (!file) {
            return NextResponse.json({ data: null, location: null, message: "Invalid file" }, { status: 400 });
        }

        const extension = ALLOWED_IMAGE_TYPES[(file as File).type];
        if (!extension) {
            return NextResponse.json({ data: null, location: null, message: "Unsupported file type" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
            return NextResponse.json({ data: null, location: null, message: "File is too large (max 5MB)" }, { status: 400 });
        }

        const today = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }).split("/");
        const UPLOAD_DIR = `uploads${path.sep}${today[2]}-${today[1]}-${today[0]}`;

        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }

        const filename = `${uuidv4()}.${extension}`;
        const relativePath = `${UPLOAD_DIR}${path.sep}${filename}`;

        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.resolve(relativePath), buffer);

        return NextResponse.json({ data: `/${relativePath}`, location: `/${relativePath}`, message: "Success" });
    } catch (error) {
        console.error('Failed to upload file:', error);
        return NextResponse.json({ data: null, location: null, message: "Something went wrong" }, { status: 500 });
    }
});
