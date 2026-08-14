import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

const { Types: { ObjectId } } = Schema;
type ICommentWithSoftDelete = Document & SoftDeleteDocument;

export interface IComment extends ICommentWithSoftDelete {
  postId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  userId: Types.ObjectId;
  content: string;
  upvoteCount: number;
  downvoteCount: number;
  visibility: boolean;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IComment>(
  {
    postId: { type: ObjectId, ref: "Post", required: true },
    parentId: { type: ObjectId, ref: "Comment", default: null },
    userId: { type: ObjectId, ref: "User", required: true },
    content: { type: String, required: true, maxlength: 5000 },
    upvoteCount: { type: Number, default: 0 },
    downvoteCount: { type: Number, default: 0 },
    visibility: { type: Boolean, default: true },
    editedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt: true, deletedBy: true, overrideMethods: true });

schema.index({ postId: 1, parentId: 1 });

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

const Comment = mongoose.models?.Comment || mongoose.model<IComment, SoftDeleteModel<IComment>>('Comment', schema, 'comments');
export default Comment;
