import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationType = "comment_reply" | "post_comment" | "post_approved" | "post_rejected";

export interface INotification extends Document {
    recipientId: Types.ObjectId;
    actorId: Types.ObjectId | null;
    type: NotificationType;
    postId: Types.ObjectId;
    commentId: Types.ObjectId | null;
    read: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const schema = new Schema<INotification>(
    {
        recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        type: { type: String, enum: ["comment_reply", "post_comment", "post_approved", "post_rejected"], required: true },
        postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        commentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
        read: { type: Boolean, default: false },
    },
    { timestamps: true }
);

// Bell list: "mine, newest first".
schema.index({ recipientId: 1, createdAt: -1 });
// Unread count and mark-all-read: "mine, unread".
schema.index({ recipientId: 1, read: 1 });

const Notification = mongoose.models?.Notification || mongoose.model<INotification>("Notification", schema, "notifications");
export default Notification;
