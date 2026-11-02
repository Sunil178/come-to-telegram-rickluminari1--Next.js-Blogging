import mongoose, { Schema, Document, Types } from "mongoose";

export type PublishRequestStatus = "Pending" | "Approved" | "Rejected";

export interface IPublishRequest extends Document {
    userId: Types.ObjectId;
    status: PublishRequestStatus;
    reviewedBy: Types.ObjectId | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const schema = new Schema<IPublishRequest>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);

schema.index({ userId: 1, status: 1 });
// At most one pending request per user, even when two requests race.
schema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "Pending" } });

const PublishRequest = mongoose.models?.PublishRequest || mongoose.model<IPublishRequest>("PublishRequest", schema, "publishrequests");
export default PublishRequest;
