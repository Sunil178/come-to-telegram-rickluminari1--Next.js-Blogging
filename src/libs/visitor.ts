// First-party visitor identity, gated by consent (D-07): no visitor cookie and no events without it.
export const CONSENT_COOKIE = "consent";
export const VISITOR_COOKIE = "vid";
export type ConsentChoice = "granted" | "denied";
export const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
// Window event that reopens the consent banner (e.g. from the footer's "Cookie preferences").
export const OPEN_CONSENT_EVENT = "open-consent-banner";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface CookieReader {
    get(name: string): { value: string } | undefined;
}

export function readConsent(cookies: CookieReader): ConsentChoice | null {
    const value = cookies.get(CONSENT_COOKIE)?.value;
    return value === "granted" || value === "denied" ? value : null;
}

export function isVisitorId(value: string | undefined): value is string {
    return Boolean(value && UUID.test(value));
}

// The visitor id, only when consent was granted and the cookie holds an id we issued (a UUID).
export function consentedVisitorId(cookies: CookieReader): string | null {
    if (readConsent(cookies) !== "granted") return null;
    const id = cookies.get(VISITOR_COOKIE)?.value;
    return isVisitorId(id) ? id : null;
}

// Cookie header parser for places that only have a raw Request (the Auth.js authorize callback).
export function cookiesFromHeader(header: string | null): CookieReader {
    const jar = new Map<string, string>();
    for (const part of (header ?? "").split(";")) {
        const index = part.indexOf("=");
        if (index > 0) jar.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
    }
    return { get: (name) => (jar.has(name) ? { value: jar.get(name)! } : undefined) };
}
