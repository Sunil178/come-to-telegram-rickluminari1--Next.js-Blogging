import mongoose, { Schema, Document, Types } from "mongoose";
import { NOTIFICATION_TYPES, type NotificationType } from "@/libs/notification-types";

export type { NotificationType };

export interface INotification extends Document {
    recipientId: Types.ObjectId;
    actorId: Types.ObjectId | null;
    type: NotificationType;
    postId: Types.ObjectId | null;
    commentId: Types.ObjectId | null;
    read: boolean;
    // Set when read; the read-notification TTL index (src/libs/notification-ttl.ts) expires from it.
    readAt: Date | null;
    // A deduplication record kept when the recipient turned in-app notifications off for its category.
    muted: boolean;
    // Set on deduplicated types (upvotes); the unique partial index below allows one per actor and target.
    dedupe?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const schema = new Schema<INotification>(
    {
        recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        type: { type: String, enum: NOTIFICATION_TYPES, required: true },
        postId: { type: Schema.Types.ObjectId, ref: "Post", default: null },
        commentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
        read: { type: Boolean, default: false },
        readAt: { type: Date, default: null },
        muted: { type: Boolean, default: false },
        dedupe: { type: Boolean },
    },
    { timestamps: true }
);

// Notifications page: "mine, newest first".
schema.index({ recipientId: 1, createdAt: -1 });
// Bell list, unread count and mark-all-read: "mine, unread, newest first".
schema.index({ recipientId: 1, read: 1, createdAt: -1 });
// Deduplication: also makes concurrent upserts of the same upvote fail instead of inserting twice.
schema.index(
    { recipientId: 1, actorId: 1, type: 1, postId: 1, commentId: 1 },
    { unique: true, partialFilterExpression: { dedupe: true } }
);

const Notification = mongoose.models?.Notification || mongoose.model<INotification>("Notification", schema, "notifications");
export default Notification;
