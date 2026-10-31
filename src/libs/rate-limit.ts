import type { RateLimiterMemory } from "rate-limiter-flexible";
import { rateLimitKey } from "@/libs/client-ip";

// The one place rate-limit keys are built and consumed, so a move to a shared store (DOC-06) or a
// key change happens once for withApiGuard and the auth limits alike.
export async function consumePoint(limiter: RateLimiterMemory, key: string): Promise<boolean> {
    try {
        await limiter.consume(key);
        return true;
    } catch {
        return false;
    }
}

export function ipKey(ip: string): string {
    return rateLimitKey(ip);
}
