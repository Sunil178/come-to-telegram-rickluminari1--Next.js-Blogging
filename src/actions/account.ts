"use server";

import Validator from "validatorjs";
import { hash } from "bcrypt";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import User from "@/models/User";
import { consumeAuthToken } from "@/libs/auth-tokens";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/libs/account-emails";
import { consumeAccountEmailAttempt } from "@/libs/auth-rate-limit";
import { getClientIp } from "@/libs/client-ip";
import { isMailConfigured } from "@/libs/mailer";
import { EMAIL_COLLATION } from "@/libs/email-match";
import { logger } from "@/libs/logger";
import { PASSWORD_RULE } from "@/libs/password-policy";

export type AccountFormState = {
    error?: string;
    message?: string;
    validationErrors?: Record<string, string[]>;
};

const GENERIC_RESEND = "If that account is waiting for verification, a new confirmation link is on its way.";
const GENERIC_RESET = "If an account uses that email, a password reset link is on its way. It expires in 1 hour.";
const MAIL_UNAVAILABLE = "Email isn't set up on this site yet. Please contact an administrator.";
const TOO_MANY = "Too many requests. Please try again later.";

function emailFrom(formData: FormData): string | null {
    const email = formData.get("email");
    if (typeof email !== "string" || new Validator({ email }, { email: "required|email" }).fails()) return null;
    return email;
}

async function requestIp(): Promise<string> {
    return getClientIp({ headers: await headers() });
}

// The lookup and the email run in after(): every request gets the same reply in the same time,
// so neither the message nor the latency reveals whether the email has an account.
export async function resendVerificationAction(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
    const email = emailFrom(formData);
    if (!email) return { error: "Enter a valid email address." };
    if (!isMailConfigured()) return { error: MAIL_UNAVAILABLE };
    if (!(await consumeAccountEmailAttempt(await requestIp(), email))) return { error: TOO_MANY };

    after(async () => {
        try {
            const user = await User.findOne({ email, emailVerifiedAt: null }).collation(EMAIL_COLLATION);
            if (user) await sendVerificationEmail({ id: user.id, email: user.email, username: user.username });
        } catch (error) {
            logger.error("Failed to resend verification email", { error });
        }
    });
    return { message: GENERIC_RESEND };
}

export async function requestPasswordResetAction(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
    const email = emailFrom(formData);
    if (!email) return { error: "Enter a valid email address." };
    if (!isMailConfigured()) return { error: MAIL_UNAVAILABLE };
    if (!(await consumeAccountEmailAttempt(await requestIp(), email))) return { error: TOO_MANY };

    after(async () => {
        try {
            const user = await User.findOne({ email }).collation(EMAIL_COLLATION);
            if (user) await sendPasswordResetEmail({ id: user.id, email: user.email, username: user.username });
        } catch (error) {
            logger.error("Failed to send password reset email", { error });
        }
    });
    return { message: GENERIC_RESET };
}

export async function verifyEmailAction(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
    const userId = await consumeAuthToken(formData.get("token") as string, "verify-email");
    if (!userId) return { error: "This confirmation link is invalid or has expired. Log in to request a new one." };

    // Matches already-verified accounts too (a second click is harmless); misses only deleted ones.
    const result = await User.updateOne({ _id: userId }, [{ $set: { emailVerifiedAt: { $ifNull: ["$emailVerifiedAt", new Date()] } } }], { updatePipeline: true });
    if (result.matchedCount === 0) return { error: "This account no longer exists." };
    redirect("/auth/login?verified=1");
}

export async function resetPasswordAction(_state: AccountFormState, formData: FormData): Promise<AccountFormState> {
    const body = {
        password: formData.get("password"),
        password_confirmation: formData.get("password_confirmation"),
    };
    // Validated before the token is consumed, so a typo doesn't burn the link.
    const validation = new Validator(body, { password: PASSWORD_RULE });
    if (validation.fails()) {
        return { error: "Please check the password fields.", validationErrors: validation.errors.all() as Record<string, string[]> };
    }

    const userId = await consumeAuthToken(formData.get("token") as string, "reset-password");
    if (!userId) return { error: "This reset link is invalid, expired or already used. Request a new one." };

    const password = await hash(body.password as string, 10);
    const now = new Date();
    const result = await User.updateOne(
        { _id: userId },
        // Following the emailed link proves the inbox, so a pending verification is complete too.
        // $literal: a bcrypt hash starts with "$", which a pipeline would read as a field path.
        // The app's clock: passwordChangedAt is compared with the JWT's authAt, also app time.
        [{ $set: { password: { $literal: password }, passwordChangedAt: now, emailVerifiedAt: { $ifNull: ["$emailVerifiedAt", now] } } }],
        { updatePipeline: true }
    );
    if (result.matchedCount === 0) return { error: "This account no longer exists." };
    redirect("/auth/login?reset=1");
}
