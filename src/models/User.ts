import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';
import { ROLES, type RoleName } from '@/libs/roles';
import type { PrivateDetails, PublicProfile } from '@/libs/profile';
import type { IpRecord } from '@/libs/geoip';

const { Types: { ObjectId } } = Schema;
type IUserWithSoftDelete = Document & SoftDeleteDocument;

export interface IUser extends IUserWithSoftDelete {
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  password: string;
  avatar: string;
  // Shown on /users/[username] (src/libs/profile.ts).
  profile: PublicProfile;
  // Visible to the user and admins only.
  privateDetails: PrivateDetails;
  role: RoleName;
  upvoteCount: number;
  downvoteCount: number;
  // Where the account was created from and last signed in from; admins see them when reviewing requests.
  signup: IpRecord | null;
  lastLogin: IpRecord | null;
  // null = awaiting verification; absent on accounts created before verification existed (treated as verified).
  emailVerifiedAt: Date | null;
  passwordChangedAt: Date;
  // Per-category channel switches (src/libs/notification-types.ts); missing entries mean "on".
  notificationPrefs: Record<string, { inApp?: boolean; push?: boolean }>;
}

export const ipRecordSchema = new Schema(
  {
    ip: String,
    location: { country: String, countryCode: String, region: String, city: String },
    at: Date,
  },
  { _id: false }
);

const schema = new Schema<IUser>(
  {
    username: String,
    firstName: String,
    middleName: String,
    lastName: String,
    email: String,
    password: String,
    avatar: String,
    profile: {
      headline: String,
      bio: String,
      country: String,
      city: String,
      website: String,
      links: { type: [String], default: undefined },
      expertise: { type: [String], default: undefined },
      topics: { type: [String], default: undefined },
      education: String,
    },
    privateDetails: {
      dateOfBirth: Date,
      gender: String,
      phone: String,
      address: String,
    },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.READER },
    upvoteCount: Number,
    downvoteCount: Number,
    signup: { type: ipRecordSchema, default: null },
    lastLogin: { type: ipRecordSchema, default: null },
    emailVerifiedAt: Date,
    passwordChangedAt: Date,
    notificationPrefs: { type: Schema.Types.Mixed, default: undefined },
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
