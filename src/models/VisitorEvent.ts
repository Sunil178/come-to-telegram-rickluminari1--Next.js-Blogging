import mongoose, { Schema, Document, Types } from "mongoose";

// Interest signals for recommendations, recorded only with consent (src/libs/visitor-events.ts).
// Anonymous events carry the visitor cookie's id; login or registration stitches them to the account.
export const VISITOR_EVENT_TTL_DAYS = 180;

export interface IVisitorEvent extends Document {
    visitorId: string;
    userId: Types.ObjectId | null;
    postId: Types.ObjectId;
    type: "post_view";
    createdAt: Date;
}

const schema = new Schema<IVisitorEvent>(
    {
        visitorId: { type: String, required: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        type: { type: String, enum: ["post_view"], required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ visitorId: 1 });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ createdAt: 1 }, { expireAfterSeconds: VISITOR_EVENT_TTL_DAYS * 24 * 60 * 60 });

const VisitorEvent = mongoose.models?.VisitorEvent || mongoose.model<IVisitorEvent>("VisitorEvent", schema, "visitor_events");
export default VisitorEvent;
