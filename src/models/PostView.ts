import mongoose, { Schema, Document } from "mongoose";

// How long one (slug, IP) pair suppresses a repeat increment -- shared with the dedupe
// cookie in the view-count route so both windows agree.
export const VIEW_DEDUPE_SECONDS = 30 * 60;

export interface IPostView extends Document {
    slug: string;
    ipHash: string;
    createdAt: Date;
}

const schema = new Schema<IPostView>({
    slug: { type: String, required: true },
    ipHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: VIEW_DEDUPE_SECONDS },
});

// The uniqueness itself is the dedupe mechanism: a second insert for the same pair
// fails atomically (E11000) instead of racing a separate read-then-write check.
schema.index({ slug: 1, ipHash: 1 }, { unique: true });

const PostView = mongoose.models?.PostView || mongoose.model<IPostView>("PostView", schema, "postviews");
export default PostView;
