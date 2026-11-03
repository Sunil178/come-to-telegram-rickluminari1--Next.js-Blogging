import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import User from "@/models/User";
import authConfig from "@/auth.config";
import { compare } from "bcrypt";
import { after } from "next/server";
import { recordLoginIp } from "@/libs/ip-history";
import { getClientIp } from "@/libs/client-ip";
import { beginLoginAttempt, recordLoginSuccess } from "@/libs/auth-rate-limit";
import { isMailConfigured } from "@/libs/mailer";
import { EMAIL_COLLATION } from "@/libs/email-match";
import { consentedVisitorId, cookiesFromHeader } from "@/libs/visitor";
import { stitchVisitor } from "@/libs/visitor-events";

// Compared against when no user has the email, so unknown and known emails take the same bcrypt time.
const DUMMY_PASSWORD_HASH = "$2b$10$Wa7YqlKRAqvDxcY2MK7SguZiMttMUqMVARgq3kQJWHwRxgxniBAZO";

// Surfaces as `code` on the client's signIn() result, so the login page can say why.
class RateLimitedSignin extends CredentialsSignin {
    code = "rate_limited";
}

// Only after the password matched, so it doesn't reveal which emails have accounts.
class EmailUnverifiedSignin extends CredentialsSignin {
    code = "email_unverified";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, request) {
                // credentials is untyped — without this, an object like { $ne: null } here
                // would act as a Mongo query operator instead of a literal value.
                if (typeof credentials?.username !== "string" || typeof credentials?.password !== "string") {
                    return null;
                }

                const ip = getClientIp(request);
                if (!(await beginLoginAttempt(ip, credentials.username))) {
                    throw new RateLimitedSignin();
                }

                const user = await User.findOne({ email: credentials.username }).collation(EMAIL_COLLATION);

                const passwordMatches = await compare(credentials.password, user?.password ?? DUMMY_PASSWORD_HASH);
                if (user && passwordMatches) {
                    // Without SMTP there's no way to verify, so the requirement is off with it. Checked before
                    // recordLoginSuccess, so a refused login neither refunds attempts nor marks the IP trusted.
                    if (!user.emailVerifiedAt && isMailConfigured()) throw new EmailUnverifiedSignin();
                    await recordLoginSuccess(ip, credentials.username);
                    // After the response: the geolocation lookup shouldn't delay signing in.
                    after(() => recordLoginIp(user.id, ip));
                    const visitorId = consentedVisitorId(cookiesFromHeader(request.headers.get("cookie")));
                    if (visitorId) await stitchVisitor(visitorId, user.id);
                    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
                    return {
                        id: user.id,
                        name: fullName || user.username,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                    };
                }
                return null;
            },
        }),
    ],
    pages: {
        signIn: '/auth/login',
    },
});
