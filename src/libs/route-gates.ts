// Pages that require a session: proxy.ts runs the auth check (and role minimums) only for these.
export function isGatedPath(pathname: string): boolean {
    return (
        pathname === "/posts/add" ||
        /^\/posts\/[^/]+\/(edit|revisions)$/.test(pathname) ||
        pathname === "/dashboard" ||
        pathname.startsWith("/dashboard/")
    );
}

// Next.js answers a 500 for a dynamic segment it can't percent-decode, so proxy.ts rejects these pages first.
// API routes stay outside the proxy: running it there would buffer every request body.
export function hasMalformedEscape(pathname: string): boolean {
    try {
        decodeURIComponent(pathname);
        return false;
    } catch {
        return true;
    }
}
