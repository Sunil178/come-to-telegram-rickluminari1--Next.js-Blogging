import { NextResponse } from "next/server";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import { formFile, saveUploadedImage, uploadLimits } from "@/libs/image-upload";
import { removeUploadIfUnused } from "@/libs/upload-cleanup";

// The replaced photo's file goes once nothing else uses it, so a removed photo stops being served.
async function replaceAvatar(userId: string, avatar: string) {
    const previous = await User.findOneAndUpdate({ _id: userId }, { $set: { avatar } }, { returnDocument: "before" }).select("avatar").lean<{ avatar?: string }>();
    if (previous?.avatar && previous.avatar !== avatar) await removeUploadIfUnused(previous.avatar);
}

// Profile photo: any signed-in user, unlike post images (authors only).
export const POST = withApiGuard(async (request, { session }) => {
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
        return NextResponse.json({ data: null, message: "Invalid request type" }, { status: 400 });
    }
    const saved = await saveUploadedImage(await formFile(request), { userId: session.user.id, purpose: "avatar" });
    if (!saved.ok) return NextResponse.json({ data: null, message: saved.message }, { status: 400 });
    try {
        await replaceAvatar(session.user.id, saved.url);
    } catch (error) {
        await removeUploadIfUnused(saved.url);
        throw error;
    }
    return NextResponse.json({ data: { avatar: saved.url }, message: "Photo updated" });
}, { rateLimit: { points: uploadLimits().perHour, duration: 60 * 60 } });

export const DELETE = withApiGuard(async (request, { session }) => {
    await replaceAvatar(session.user.id, "");
    return NextResponse.json({ data: null, message: "Photo removed" });
});
