import { NextResponse } from "next/server";
import { compare, hash } from "bcrypt";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import Validator from "validatorjs";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULE } from "@/libs/password-policy";

// Changes the password of the signed-in account after checking the current one. Setting passwordChangedAt
// signs every session out at its next check, this one included, so the page sends the user to sign in again.
export const POST = withApiGuard(async (request, { session }) => {
    const body = await request.json().catch(() => null);
    const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const next = typeof body?.password === "string" ? body.password : "";
    // The same rule as registration and reset.
    const validation = new Validator({ password: next, password_confirmation: body?.passwordConfirmation }, { password: PASSWORD_RULE });
    if (validation.fails()) {
        const message = next.length < PASSWORD_MIN_LENGTH ? `The new password needs at least ${PASSWORD_MIN_LENGTH} characters.` : "The new passwords don't match.";
        return NextResponse.json({ data: null, message }, { status: 400 });
    }

    const user = await User.findById(session.user.id).select("password").lean<{ password?: string }>();
    if (!user?.password || !(await compare(current, user.password))) {
        return NextResponse.json({ data: null, message: "Your current password isn't correct." }, { status: 403 });
    }
    if (await compare(next, user.password)) {
        return NextResponse.json({ data: null, message: "Choose a password different from your current one." }, { status: 400 });
    }

    await User.updateOne({ _id: session.user.id }, { $set: { password: await hash(next, 10), passwordChangedAt: new Date() } });
    return NextResponse.json({ data: null, message: "Password changed" });
}, { rateLimit: { points: 5, duration: 15 * 60 } });
