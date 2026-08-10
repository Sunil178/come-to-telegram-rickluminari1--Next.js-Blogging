import authConfig from "./auth.config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    if (!req.auth) {
        const loginUrl = new URL("/auth/login", req.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }
});

export const config = {
    matcher: ["/posts/add", "/posts/:slug/edit", "/dashboard/:path*"],
};
