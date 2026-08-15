import authConfig from "./auth.config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { hasRole, ROLES, type RoleName } from "@/libs/roles";

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
    { prefix: "/dashboard/admin/posts", minimum: ROLES.MODERATOR },
    { prefix: "/dashboard/admin/comments", minimum: ROLES.MODERATOR },
];

export default auth((req) => {
    if (!req.auth) {
        const loginUrl = new URL("/auth/login", req.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    const requirement = ROLE_REQUIREMENTS.find((r) => req.nextUrl.pathname.startsWith(r.prefix));
    if (requirement && !hasRole(req.auth.user.role, requirement.minimum)) {
        return NextResponse.redirect(new URL("/dashboard/posts", req.nextUrl.origin));
    }
});

export const config = {
    matcher: ["/posts/add", "/posts/:slug/edit", "/dashboard/:path*"],
};
