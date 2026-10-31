import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPostRevision extends Document {
    postId: Types.ObjectId;
    // Who made the edit that replaced this version.
    editorId: Types.ObjectId;
    title: string;
    titleDescription: string;
    tags: string[];
    bannerImage: string;
    content: string;
    createdAt: Date;
}

// A snapshot of a post as it was before an edit (src/libs/post-revisions.ts keeps the latest few per post).
const schema = new Schema<IPostRevision>(
    {
        postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
        editorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        title: String,
        titleDescription: String,
        tags: { type: [String], default: [] },
        bannerImage: { type: String, default: "" },
        content: { type: String, default: "" },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

schema.index({ postId: 1, createdAt: -1 });

const PostRevision = mongoose.models?.PostRevision || mongoose.model<IPostRevision>("PostRevision", schema, "post_revisions");
export default PostRevision;
