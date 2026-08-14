/**
 * Login redirect target for client components reacting to a 401 from their own
 * fetch call (voting, commenting, posting, deleting) on an otherwise publicly
 * viewable page. See CLAUDE.md's "Route protection" section.
 */
export function loginRedirectUrl(path: string): string {
    return `/auth/login?callbackUrl=${encodeURIComponent(path)}`;
}
