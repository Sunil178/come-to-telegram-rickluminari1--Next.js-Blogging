import { createHash } from "crypto";
import { isIPv6 } from "net";

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
    if (!forwardedFor) return "unknown";
    const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1);
    const entries = forwardedFor.split(",").map((entry) => entry.trim()).filter(Boolean);
    // Fewer entries than trusted proxies means one was bypassed, so none of them can be trusted.
    return entries.length >= hops ? entries[entries.length - hops] : "unknown";
}

// IPv6 users typically get a whole /64, so per-address keys would let them rotate through fresh buckets.
export function rateLimitKey(ip: string): string {
    if (!isIPv6(ip)) return ip;
    const [head, tail = ""] = ip.split("::");
    const headParts = head ? head.split(":") : [];
    const tailParts = tail ? tail.split(":") : [];
    const groups = ip.includes("::")
        ? [...headParts, ...Array(8 - headParts.length - tailParts.length).fill("0"), ...tailParts]
        : headParts;
    return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

export function hashIp(ip: string): string {
    return createHash("sha256").update(ip).digest("hex");
}
