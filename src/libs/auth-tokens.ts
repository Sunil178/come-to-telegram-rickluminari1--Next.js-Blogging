import { createHash, randomBytes } from "crypto";
import AuthToken, { type AuthTokenPurpose } from "@/models/AuthToken";

export const TOKEN_LIFETIME_MS: Record<AuthTokenPurpose, number> = {
    "verify-email": 24 * 60 * 60 * 1000,
    "reset-password": 60 * 60 * 1000,
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Returns the raw token for the emailed link. One live token per user and purpose (unique index),
// replaced in a single upsert, so concurrent sends can't leave an earlier link working.
export async function createAuthToken(userId: string, purpose: AuthTokenPurpose): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await AuthToken.updateOne(
        { userId, purpose },
        { $set: { tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS[purpose]) } },
        { upsert: true }
    );
    return token;
}

// Atomic find-and-delete, so two concurrent submissions of one link can't both succeed.
export async function consumeAuthToken(token: string, purpose: AuthTokenPurpose): Promise<string | null> {
    if (typeof token !== "string" || !token) return null;
    const record = await AuthToken.findOneAndDelete({
        tokenHash: hashToken(token),
        purpose,
        expiresAt: { $gt: new Date() },
    });
    return record ? record.userId.toString() : null;
}
