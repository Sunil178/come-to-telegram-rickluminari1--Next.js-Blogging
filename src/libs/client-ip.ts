import { createHash } from "crypto";

// Proxies append the address they saw to X-Forwarded-For, so only the entries added by our own
// proxies are trustworthy: the client IP is TRUSTED_PROXY_HOPS entries from the right (default 1).
// Next.js itself fills the header only when it's absent, so without a proxy it is client-controlled.
// Takes anything with headers: a NextRequest, the Request Auth.js passes to authorize(), or headers() in a server action.
export function getClientIp(request: { headers: Headers }): string {
    const header = process.env.CLIENT_IP_HEADER;
    if (header) {
        // Fail closed: a request without the CDN's header bypassed the CDN, and its X-Forwarded-For is client-controlled.
        return request.headers.get(header)?.trim() || "unknown";
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1);
        const entries = forwardedFor.split(",").map((entry) => entry.trim()).filter(Boolean);
        const ip = entries[Math.max(0, entries.length - hops)];
        if (ip) return ip;
    }
    return request.headers.get("x-real-ip") || "unknown";
}

export function hashIp(ip: string): string {
    return createHash("sha256").update(ip).digest("hex");
}
