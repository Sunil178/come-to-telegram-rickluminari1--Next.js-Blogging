import authConfig from "./auth.config";
import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { hasRole, ROLES, type RoleName } from "@/libs/roles";
import { buildContentSecurityPolicy } from "@/libs/csp";
import { isGatedPath } from "@/libs/route-gates";
import { SITE_URL } from "@/libs/site-url";

const { auth } = NextAuth(authConfig);

// Path prefixes needing more than "just logged in". Ownership-based checks (e.g. can
// this user edit *this* post) need a DB read and stay at the page/route level instead —
// this list is only for checks resolvable from the role already in the session.
const ROLE_REQUIREMENTS: { prefix: string; minimum: RoleName }[] = [
    { prefix: "/posts/add", minimum: ROLES.AUTHOR },
    { prefix: "/dashboard/admin/users", minimum: ROLES.ADMIN },
    { prefix: "/dashboard/admin/categories", minimum: ROLES.ADMIN },
    { prefix: "/dashboard/admin/requests", minimum: ROLES.ADMIN },
    { prefix: "/dashboard/admin/all-posts", minimum: ROLES.ADMIN },
    { prefix: "/dashboard/admin/uploads", minimum: ROLES.ADMIN },
    { prefix: "/dashboard/admin/posts", minimum: ROLES.MODERATOR },
    { prefix: "/dashboard/admin/comments", minimum: ROLES.MODERATOR },
];

// Fresh nonce per request; Next.js reads it from the request's CSP header and applies it to its own scripts.
function withCsp(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = buildContentSecurityPolicy({
        nonce,
        isDev: process.env.NODE_ENV === "development",
        upgradeInsecureRequests: SITE_URL.startsWith("https://"),
    });
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
}

const gatedProxy = auth((req) => {
    if (!req.auth) {
        const loginUrl = new URL("/auth/login", req.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    const requirement = ROLE_REQUIREMENTS.find((r) => req.nextUrl.pathname.startsWith(r.prefix));
    if (requirement && !hasRole(req.auth.user.role, requirement.minimum)) {
        return NextResponse.redirect(new URL("/dashboard/posts", req.nextUrl.origin));
    }
    return withCsp(req);
});

// The Auth.js wrapper runs only on gated pages: elsewhere it would re-issue the session cookie on
// every response and re-check the role in the DB for no reason.
export default function proxy(request: NextRequest, event: Parameters<typeof gatedProxy>[1]) {
    return isGatedPath(request.nextUrl.pathname) ? gatedProxy(request, event) : withCsp(request);
}

export const config = {
    // Every page (for the CSP nonce); API routes, static assets, and non-HTML metadata routes are skipped.
    matcher: [
        // Prefetches are deliberately NOT excluded (unlike the CSP guide's example): skipping proxy.ts for
        // them would let a forged prefetch header fetch gated pages' data without the auth gate.
        "/((?!api/|_next/static|_next/image|uploads/|assets/|manifest.webmanifest|robots.txt|sitemap.xml|feed.xml|.*\\.(?:svg|png|jpe?g|gif|webp|ico|txt|xml|js|css|woff2?)$).*)",
    ],
};
