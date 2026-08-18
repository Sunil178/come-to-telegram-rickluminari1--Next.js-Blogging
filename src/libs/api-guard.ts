import { cache } from "react";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { hasRole, type RoleName } from "@/libs/roles";
import { getClientIp } from "@/libs/client-ip";

// Memoized per request/render pass, per Next.js's recommended Data Access Layer pattern:
// https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal
export const getSession = cache(auth);

// Also the trusted session type for pages matched in proxy.ts's `config.matcher`,
// which guarantees a session is present before they render.
export type AuthenticatedSession = Session & { user: NonNullable<Session["user"]> & { id: string } };

type RateLimitOptions = { points: number; duration: number };

interface ApiGuardOptions {
    /** Require a logged-in session; unauthenticated requests get a 401 before the handler runs. Defaults to true. */
    auth?: boolean;
    /** Minimum role required; implies `auth`. Requests below this rank get a 403 before the handler runs. */
    role?: RoleName;
    /** Max requests per IP within `duration` seconds; excess requests get a 429 before the handler runs. */
    rateLimit?: RateLimitOptions;
}

/**
 * Wraps a Route Handler with cross-cutting API concerns, declared via one
 * options object instead of nested wrapper calls. This is the one place
 * that enforces those concerns -- add new ones as new `ApiGuardOptions`
 * keys and check them here; route files only ever change their options,
 * never their own security logic. `auth` defaults to true, so most routes
 * need no options at all:
 *
 *   export const POST = withApiGuard(async (request, { session }) => { ... });
 *   export const GET = withApiGuard(async (request) => { ... }, { auth: false }); // public route
 *   export const PATCH = withApiGuard(async (request, { session }) => { ... }, { role: ROLES.MODERATOR });
 *   export const POST = withApiGuard(async (request) => { ... }, { auth: false, rateLimit: { points: 20, duration: 60 } }); // public + rate-limited
 *
 * Next.js's own docs endorse wrapping Route Handlers this way ("factory" pattern):
 * https://nextjs.org/docs/app/guides/backend-for-frontend#library-patterns
 */
export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: Context & { session: AuthenticatedSession }) => Promise<Response> | Response,
    options: { auth?: true; role: RoleName; rateLimit?: RateLimitOptions }
): (request: NextRequest, context: Context) => Promise<Response>;

export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: Context & { session: AuthenticatedSession }) => Promise<Response> | Response,
    options?: { auth?: true; rateLimit?: RateLimitOptions }
): (request: NextRequest, context: Context) => Promise<Response>;

export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: Context) => Promise<Response> | Response,
    options: { auth: false; rateLimit?: RateLimitOptions }
): (request: NextRequest, context: Context) => Promise<Response>;

export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: any) => Promise<Response> | Response,
    options: ApiGuardOptions = {}
) {
    const requireAuth = options.auth ?? true;
    // Created once per route at module load, not per request, so counts persist across calls.
    // In-memory only: resets on restart, not shared across instances (no Redis in this stack yet).
    const limiter = options.rateLimit ? new RateLimiterMemory(options.rateLimit) : null;

    return async (request: NextRequest, context: Context) => {
        if (limiter) {
            try {
                await limiter.consume(getClientIp(request));
            } catch {
                return NextResponse.json({ data: null, message: "Too many requests" }, { status: 429 });
            }
        }
        if (requireAuth) {
            const session = await getSession();
            if (!session?.user?.id) {
                return NextResponse.json({ data: null, message: "Unauthorized" }, { status: 401 });
            }
            if (options.role && !hasRole(session.user.role, options.role)) {
                return NextResponse.json({ data: null, message: "Forbidden" }, { status: 403 });
            }
            return handler(request, { ...context, session: session as AuthenticatedSession });
        }
        return handler(request, context);
    };
}
