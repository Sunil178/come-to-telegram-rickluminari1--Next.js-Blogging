import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

const { Types: { ObjectId } } = Schema;
type ICategoryWithSoftDelete = Document & SoftDeleteDocument;

export interface ICategory extends ICategoryWithSoftDelete {
  parentId: Types.ObjectId;
  title: string;
  slug: string;
  content: string;
  visibility: boolean;
}

const schema = new Schema<ICategory>(
  {
    parentId: { type: ObjectId, ref: "Category" },
    title: String,
    slug: String,
    content: String,
    visibility: Boolean,
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt : true, deletedBy: true, overrideMethods: true });

schema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

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

const Category = mongoose.models?.Category || mongoose.model<ICategory, SoftDeleteModel<ICategory>>('Category', schema, 'categories');
export default Category;
