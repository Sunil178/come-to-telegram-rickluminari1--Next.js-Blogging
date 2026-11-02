import { NextResponse } from "next/server";
import { withApiGuard } from "@/libs/api-guard";
import { parseProfileInput, PRIVATE_PROFILE_FIELDS, PUBLIC_PROFILE_FIELDS } from "@/libs/profile";
import { saveProfileFields } from "@/libs/profile-store";

// Saves the account page's profile form: any public or private profile field present in the body.
export const PATCH = withApiGuard(async (request, { session }) => {
    const parsed = parseProfileInput(await request.json().catch(() => null), [...PUBLIC_PROFILE_FIELDS, ...PRIVATE_PROFILE_FIELDS]);
    if (!parsed.ok) return NextResponse.json({ data: null, message: parsed.message }, { status: 400 });
    await saveProfileFields(session.user.id, parsed.set);
    return NextResponse.json({ data: null, message: "Profile saved" });
}, { rateLimit: { points: 30, duration: 60 } });
