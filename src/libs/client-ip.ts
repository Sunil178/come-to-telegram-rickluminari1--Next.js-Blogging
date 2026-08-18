import { createHash } from "crypto";
import type { NextRequest } from "next/server";

// Trustworthy only behind a reverse proxy that sets/overwrites this header itself —
// with no proxy in front, a client can set it directly and this returns whatever they claim.
export function getClientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();
    return request.headers.get("x-real-ip") || "unknown";
}

export function hashIp(ip: string): string {
    return createHash("sha256").update(ip).digest("hex");
}
