// Pages that require a session: proxy.ts runs the auth check (and role minimums) only for these.
export function isGatedPath(pathname: string): boolean {
    return (
        pathname === "/posts/add" ||
        /^\/posts\/[^/]+\/edit$/.test(pathname) ||
        pathname === "/dashboard" ||
        pathname.startsWith("/dashboard/")
    );
}
