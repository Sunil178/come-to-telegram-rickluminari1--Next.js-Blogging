// web-push POSTs to whatever endpoint is stored, so accepting arbitrary URLs would let any
// user aim server-side requests at internal hosts (SSRF). Only the browsers' push services pass.
const EXACT_HOSTS = new Set(["fcm.googleapis.com", "web.push.apple.com"]);
const HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com"];

export const MAX_ENDPOINT_LENGTH = 2048;

export function isAllowedPushEndpoint(endpoint: string): boolean {
    if (endpoint.length > MAX_ENDPOINT_LENGTH) return false;
    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        return false;
    }
    if (url.protocol !== "https:" || url.port || url.username || url.password) return false;
    return EXACT_HOSTS.has(url.hostname) || HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix));
}
