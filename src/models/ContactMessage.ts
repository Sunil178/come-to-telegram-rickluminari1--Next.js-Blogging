import mongoose, { Schema, Document, Types } from "mongoose";
import { CONTACT_TOPICS, type ContactTopic } from "@/libs/contact";

export type ContactStatus = "open" | "resolved";

// Resolved messages are kept a year, so a repeat complaint can be traced to the first one.
export const RESOLVED_MESSAGE_RETENTION_DAYS = 365;

export interface IContactMessage extends Document {
    reference: string;
    topic: ContactTopic;
    name: string;
    email: string;
    url: string | null;
    message: string;
    // The sender's account when they were signed in.
    userId: Types.ObjectId | null;
    ip: string;
    status: ContactStatus;
    resolvedAt: Date | null;
    resolvedBy: Types.ObjectId | null;
    createdAt: Date;
}

const schema = new Schema<IContactMessage>(
    {
        reference: { type: String, required: true, unique: true },
        topic: { type: String, enum: Object.keys(CONTACT_TOPICS), required: true },
        name: { type: String, required: true },
        email: { type: String, required: true },
        url: { type: String, default: null },
        message: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        ip: { type: String, default: "" },
        status: { type: String, enum: ["open", "resolved"], default: "open" },
        resolvedAt: { type: Date, default: null },
        resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ status: 1, createdAt: -1 });
// Open messages have no resolvedAt, so only resolved ones expire.
schema.index({ resolvedAt: 1 }, { expireAfterSeconds: RESOLVED_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 });

const ContactMessage = mongoose.models?.ContactMessage || mongoose.model<IContactMessage>("ContactMessage", schema, "contactmessages");
export default ContactMessage;
