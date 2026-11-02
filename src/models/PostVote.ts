import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

const { Types: { ObjectId } } = Schema;
type IPostVoteWithSoftDelete = Document & SoftDeleteDocument;

export interface IPostVote extends IPostVoteWithSoftDelete {
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  type: boolean;
}

const schema = new Schema<IPostVote>(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    postId: { type: ObjectId, ref: "Post", required: true },
    type: { type: Boolean, required: true },
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt: true, deletedBy: true, overrideMethods: true });

schema.index({ userId: 1, postId: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
// Serves the per-target recount; mongoose-delete adds deleted to every count.
schema.index({ postId: 1, deleted: 1, type: 1 });

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

const PostVote = mongoose.models?.PostVote || mongoose.model<IPostVote, SoftDeleteModel<IPostVote>>('PostVote', schema, 'post_votes');
export default PostVote;
