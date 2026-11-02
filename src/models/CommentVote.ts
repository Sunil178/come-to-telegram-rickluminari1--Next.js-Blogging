import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

const { Types: { ObjectId } } = Schema;
type ICommentVoteWithSoftDelete = Document & SoftDeleteDocument;

export interface ICommentVote extends ICommentVoteWithSoftDelete {
  userId: Types.ObjectId;
  commentId: Types.ObjectId;
  type: boolean;
}

const schema = new Schema<ICommentVote>(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    commentId: { type: ObjectId, ref: "Comment", required: true },
    type: { type: Boolean, required: true },
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt: true, deletedBy: true, overrideMethods: true });

schema.index({ userId: 1, commentId: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
// Serves the per-target recount; mongoose-delete adds deleted to every count.
schema.index({ commentId: 1, deleted: 1, type: 1 });

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

const CommentVote = mongoose.models?.CommentVote || mongoose.model<ICommentVote, SoftDeleteModel<ICommentVote>>('CommentVote', schema, 'comment_votes');
export default CommentVote;
