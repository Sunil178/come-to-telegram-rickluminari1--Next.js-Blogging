import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';
import type { RoleName } from '@/libs/roles';

const { Types: { ObjectId } } = Schema;
type IUserWithSoftDelete = Document & SoftDeleteDocument;

export interface IUser extends IUserWithSoftDelete {
  tempUserId: Types.ObjectId;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
  email: string;
  password: string;
  avatar: string;
  intro: string;
  profile: string;
  role: RoleName;
  upvoteCount: number;
  downvoteCount: number;
  lastLoginAt: Date;
}

const schema = new Schema<IUser>(
  {
    tempUserId: { type: ObjectId, ref: "TempUser" },
    username: String,
    firstName: String,
    middleName: String,
    lastName: String,
    mobile: String,
    email: String,
    password: String,
    avatar: String,
    intro: String,
    profile: String,
    role: { type: String, enum: ["reader", "author", "moderator", "admin"], default: "reader" },
    upvoteCount: Number,
    downvoteCount: Number,
    lastLoginAt: Date,
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt : true, deletedBy: true, overrideMethods: true });

schema.index({ username: 1 }, { unique: true });

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

const User = mongoose.models?.User || mongoose.model<IUser, SoftDeleteModel<IUser>>('User', schema, 'users');
export default User;
