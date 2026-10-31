/**
 * Login redirect target for client components reacting to a 401 from their own
 * fetch call (voting, commenting, posting, deleting) on an otherwise publicly
 * viewable page. See AGENTS.md's "Route protection and CSP" section.
 */
export function loginRedirectUrl(path: string): string {
    return `/auth/login?callbackUrl=${encodeURIComponent(path)}`;
}

// Resolves the target against our origin rather than prefix-checking it: browsers treat "\\" as "/",
// so "/\\evil.com" passes a startsWith("/") check yet navigates off-site.
export function safeCallbackPath(callbackUrl: string | null, origin: string, fallback = "/posts"): string {
    if (!callbackUrl || !callbackUrl.startsWith("/")) return fallback;
    try {
        const url = new URL(callbackUrl, origin);
        return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : fallback;
    } catch {
        return fallback;
    }
}
