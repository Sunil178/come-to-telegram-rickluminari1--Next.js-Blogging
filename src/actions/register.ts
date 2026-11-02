"use server";

import User from "@/models/User";
import Validator from "validatorjs";
import { hash } from "bcrypt";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { sendVerificationEmail } from "@/libs/account-emails";
import { isMailConfigured } from "@/libs/mailer";
import { EMAIL_COLLATION } from "@/libs/email-match";
import { getClientIp } from "@/libs/client-ip";
import { consumeRegistrationAttempt } from "@/libs/auth-rate-limit";
import { logger } from "@/libs/logger";
import { consentedVisitorId } from "@/libs/visitor";
import { stitchVisitor } from "@/libs/visitor-events";
import { PASSWORD_RULE } from "@/libs/password-policy";
import { recordSignupIp } from "@/libs/ip-history";

// Define the state type for better TypeScript support
export type RegisterState = {
    error?: string;
    validationErrors?: Record<string, string[]>;
    success?: boolean;
};

export async function registerAction(initialState: RegisterState, formData: FormData): Promise<RegisterState> {
    const body = Object.fromEntries(formData.entries());

    // 1. Validation Rules
    const rules = {
        username: "required|min:3",
        firstName: "required",
        lastName: "required",
        email: "required|email",
        password: PASSWORD_RULE, // Requires password_confirmation field in UI
    };

    const validation = new Validator(body, rules);

    if (validation.fails()) {
        return {
            error: "Validation failed. Please check the fields.",
            validationErrors: validation.errors.all() as Record<string, string[]>,
        };
    }

    // Counted after validation, so fixing form errors doesn't use up the budget.
    const ip = getClientIp({ headers: await headers() });
    if (!(await consumeRegistrationAttempt(ip))) {
        return { error: "Too many registration attempts. Please try again later." };
    }

    const mustVerify = isMailConfigured();
    try {
        // 2. Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email: body.email }, { username: body.username }],
        }).collation(EMAIL_COLLATION);

        if (existingUser) {
            return { error: "User with this email or username already exists." };
        }

        // 3. Create User
        const user = await User.create({
            username: body.username,
            firstName: body.firstName,
            middleName: body.middleName || "",
            lastName: body.lastName,
            email: body.email,
            password: await hash(body.password as string, 10),
            // Without SMTP there's no way to verify, so accounts start verified.
            emailVerifiedAt: mustVerify ? null : new Date(),
        });
        after(() => recordSignupIp(user.id, ip));
        const visitorId = consentedVisitorId(await cookies());
        if (visitorId) await stitchVisitor(visitorId, user.id);
        if (mustVerify) {
            after(() => sendVerificationEmail({ id: user.id, email: user.email, username: user.username }).catch((error) => {
                logger.error("Failed to send verification email", { error });
            }));
        }
    } catch (error: any) {
        logger.error("Registration Error", { error });
        return { error: "An internal server error occurred." };
    }

    // 4. Redirect on success
    // redirect() throws an error internally, so it must be called outside the try/catch
    // or handled specifically. Next.js handles redirects in actions automatically.
    redirect(mustVerify ? "/auth/login?registered=verify" : "/auth/login?registered=1");
}
