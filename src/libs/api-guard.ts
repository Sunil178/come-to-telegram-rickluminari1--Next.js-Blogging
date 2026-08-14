import { cache } from "react";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/app/api/auth/[...nextauth]/auth";

// Memoized per request/render pass, per Next.js's recommended Data Access Layer pattern:
// https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal
export const getSession = cache(auth);

// Also the trusted session type for pages matched in proxy.ts's `config.matcher`,
// which guarantees a session is present before they render.
export type AuthenticatedSession = Session & { user: NonNullable<Session["user"]> & { id: string } };

interface ApiGuardOptions {
    /** Require a logged-in session; unauthenticated requests get a 401 before the handler runs. Defaults to true. */
    auth?: boolean;
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
 *
 * Next.js's own docs endorse wrapping Route Handlers this way ("factory" pattern):
 * https://nextjs.org/docs/app/guides/backend-for-frontend#library-patterns
 */
export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: Context & { session: AuthenticatedSession }) => Promise<Response> | Response,
    options?: { auth?: true }
): (request: NextRequest, context: Context) => Promise<Response>;

export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: Context) => Promise<Response> | Response,
    options: { auth: false }
): (request: NextRequest, context: Context) => Promise<Response>;

export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: any) => Promise<Response> | Response,
    options: ApiGuardOptions = {}
) {
    const requireAuth = options.auth ?? true;
    return async (request: NextRequest, context: Context) => {
        if (requireAuth) {
            const session = await getSession();
            if (!session?.user?.id) {
                return NextResponse.json({ data: null, message: "Unauthorized" }, { status: 401 });
            }
            return handler(request, { ...context, session: session as AuthenticatedSession });
        }
        return handler(request, context);
    };
}
