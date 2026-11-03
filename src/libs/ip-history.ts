import User from "@/models/User";
import { ipRecord } from "@/libs/geoip";
import { logger } from "@/libs/logger";

// Kept for admins reviewing requests to publish (no expiry; account deletion removes them).
// Best effort: a failed write must never block signing up or in.
export async function recordSignupIp(userId: string, ip: string): Promise<void> {
    try {
        await User.updateOne({ _id: userId }, { $set: { signup: await ipRecord(ip) } });
    } catch (error) {
        logger.warn("Failed to record the sign-up address", { error });
    }
}

export async function recordLoginIp(userId: string, ip: string): Promise<void> {
    try {
        await User.updateOne({ _id: userId }, { $set: { lastLogin: await ipRecord(ip) } });
    } catch (error) {
        logger.warn("Failed to record the sign-in address", { error });
    }
}
