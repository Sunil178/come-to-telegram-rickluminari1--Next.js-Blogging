import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

export enum ApprovalStatus {
  Pending = "Pending",
  Approved = "Approved",
  Rejected = "Rejected",
  Inactive = "Inactive",
}

const { Types: { ObjectId } } = Schema;
type IPostWithSoftDelete = Document & SoftDeleteDocument;

export interface IPost extends IPostWithSoftDelete {
  userId: Types.ObjectId;
  parentId: Types.ObjectId;
  categoryId: Types.ObjectId;
  slug: string;
  title: string;
  titleDescription: string;
  tags: string[];
  bannerImage: string;
  content: string;
  summary: string;
  upvoteCount: number;
  downvoteCount: number;
  commentCount: number;
  visibility: boolean;
  published: boolean;
  publishedAt: Date;
  // Author-requested publish time; approval publishes at the later of this and the approval itself.
  publishAt: Date | null;
  visitorCount: number;
  approval: ApprovalStatus;
  approvedAt: Date;
  rejectionReason: string | null;
}

const schema = new Schema<IPost>(
  {
    userId: { type: ObjectId, ref: "User" },
    parentId: { type: ObjectId, ref: "Post" },
    categoryId: { type: ObjectId, ref: "Category" },
    slug: String,
    title: String,
    titleDescription: String,
    tags: { type: [String], default: [] },
    bannerImage: { type: String, default: "" },
    content: { type: String, default: "" },
    summary: { type: String, default: "" },
    upvoteCount: { type: Number, default: 0 },
    downvoteCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    visibility: { type: Boolean, default: true },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    publishAt: { type: Date, default: null },
    visitorCount: { type: Number, default: 0 },
    approval: { type: String, enum: Object.values(ApprovalStatus), default: ApprovalStatus.Pending },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt : true, deletedBy: true, overrideMethods: true });

schema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
schema.index({ categoryId: 1 });
schema.index({ userId: 1 });
// Related posts match on shared tags (src/libs/related-posts.ts).
schema.index({ tags: 1 });
// Posts search (src/libs/post-search.ts): one text index per collection, title weighted highest.
schema.index(
  { title: "text", tags: "text", titleDescription: "text", summary: "text" },
  { name: "post_search", weights: { title: 10, tags: 6, titleDescription: 4, summary: 2 } }
);
// Public post lists and related posts: newest first.
schema.index({ publishedAt: -1 });

// Hide soft-delete metadata in API responses
schema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    delete ret.deleted;
    delete ret.deletedAt;
    delete ret.deletedBy;
    return ret;
  },
});

const Post = mongoose.models?.Post || mongoose.model<IPost, SoftDeleteModel<IPost>>('Post', schema, 'posts');
export default Post;
