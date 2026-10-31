import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPushSubscription extends Document {
    userId: Types.ObjectId;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    createdAt: Date;
    updatedAt: Date;
}

const schema = new Schema<IPushSubscription>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        endpoint: { type: String, required: true, unique: true },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true },
        },
    },
    { timestamps: true }
);

schema.index({ userId: 1 });

const PushSubscription = mongoose.models?.PushSubscription || mongoose.model<IPushSubscription>("PushSubscription", schema, "pushsubscriptions");
export default PushSubscription;
