import mongoose, { Schema, Document, Types } from "mongoose";

export type UploadPurpose = "post" | "avatar";

// What the original file's EXIF said. The served copy has it stripped; this stays private (uploader, admins).
export interface UploadMetadata {
    make?: string;
    model?: string;
    lens?: string;
    software?: string;
    takenAt?: Date;
    gps?: { latitude: number; longitude: number; altitude?: number };
}

export interface IUpload extends Document {
    url: string;
    userId: Types.ObjectId;
    purpose: UploadPurpose;
    mimeType: string;
    size: number;
    originalSize: number;
    width: number;
    height: number;
    metadata: UploadMetadata | null;
    // Set when the file is deleted; the record lingers so the day's upload count still includes it.
    removedAt: Date | null;
    createdAt: Date;
}

const schema = new Schema<IUpload>(
    {
        url: { type: String, required: true, unique: true },
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        purpose: { type: String, enum: ["post", "avatar"], required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        originalSize: { type: Number, required: true },
        width: Number,
        height: Number,
        metadata: { type: Schema.Types.Mixed, default: null },
        removedAt: { type: Date, default: null },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

// Per-uploader daily count and storage totals.
schema.index({ userId: 1, createdAt: -1 });
// Removed files' records go once they no longer count towards the daily limit.
schema.index({ removedAt: 1 }, { expireAfterSeconds: 2 * 24 * 60 * 60 });

const Upload = mongoose.models?.Upload || mongoose.model<IUpload>("Upload", schema, "uploads");
export default Upload;
