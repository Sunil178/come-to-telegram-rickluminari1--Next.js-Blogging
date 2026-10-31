import mongoose, { Schema, Document, Types } from "mongoose";

export type AuthTokenPurpose = "verify-email" | "reset-password";

export interface IAuthToken extends Document {
    userId: Types.ObjectId;
    purpose: AuthTokenPurpose;
    tokenHash: string;
    expiresAt: Date;
}

// One-time email links. Only a SHA-256 of the token is stored, so a database leak doesn't hand out live links.
const schema = new Schema<IAuthToken>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        purpose: { type: String, enum: ["verify-email", "reset-password"], required: true },
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true }
);

schema.index({ tokenHash: 1 }, { unique: true });
schema.index({ userId: 1, purpose: 1 }, { unique: true });
// MongoDB's TTL monitor removes expired tokens (consumers still check expiresAt; the monitor runs once a minute).
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthToken = mongoose.models?.AuthToken || mongoose.model<IAuthToken>("AuthToken", schema, "auth_tokens");
export default AuthToken;
