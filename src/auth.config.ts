import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import mongoose from "mongoose";
import { ROLES, type RoleName } from "@/libs/roles";

// Trades a bounded staleness window for far fewer DB reads on every request.
const ROLE_RECHECK_INTERVAL_MS = 60_000;

export default {
    providers: [Credentials],
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.username = token.username;
                session.user.role = token.role;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.username = user.username;
                token.role = user.role;
                token.roleCheckedAt = Date.now();
                return token;
            }

            // Re-checks the DB so a promotion/demotion takes effect without waiting for the
            // 30-day JWT to expire. Safe from proxy.ts too — Next.js 16 defaults proxy to Node.js, not Edge.
            const isStale = Date.now() - (token.roleCheckedAt ?? 0) > ROLE_RECHECK_INTERVAL_MS;
            if (token.id && isStale) {
                // mongoose.model("User"), not the typed User import — importing that module here
                // breaks .lean() type inference project-wide (verified in `next build`, not a tsc quirk).
                const dbUser = await mongoose.model("User").findById(token.id).select("role").lean<{ role?: RoleName }>();
                token.role = dbUser?.role ?? ROLES.READER;
                token.roleCheckedAt = Date.now();
            }
            return token;
        },
    },
} satisfies NextAuthConfig;
