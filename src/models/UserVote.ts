import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

const { Types: { ObjectId } } = Schema;
type IUserVoteWithSoftDelete = Document & SoftDeleteDocument;

export interface IUserVote extends IUserVoteWithSoftDelete {
  userId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  type: boolean;
}

const schema = new Schema<IUserVote>(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    targetUserId: { type: ObjectId, ref: "User", required: true },
    type: { type: Boolean, required: true },
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt: true, deletedBy: true, overrideMethods: true });

schema.index({ userId: 1, targetUserId: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

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

const UserVote = mongoose.models?.UserVote || mongoose.model<IUserVote, SoftDeleteModel<IUserVote>>('UserVote', schema, 'user_votes');
export default UserVote;
