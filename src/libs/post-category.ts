import { isValidObjectId, type Types } from "mongoose";
import Category from "@/models/Category";

/** The post form's category field: empty means none; anything else must be a visible category. */
export async function parseCategoryId(raw: FormDataEntryValue | null): Promise<{ ok: true; value: Types.ObjectId | null } | { ok: false }> {
    if (raw === null || raw === "") return { ok: true, value: null };
    if (typeof raw !== "string" || !isValidObjectId(raw)) return { ok: false };
    const category = await Category.findOne({ _id: raw, visibility: true }).select("_id").lean<{ _id: Types.ObjectId }>();
    return category ? { ok: true, value: category._id } : { ok: false };
}

/** The categories an author can choose from in the post form. */
export async function categoryOptions(): Promise<{ id: string; title: string }[]> {
    const categories = await Category.find({ visibility: true }).select("title").sort({ title: 1 }).lean<{ _id: Types.ObjectId; title: string }[]>();
    return categories.map((category) => ({ id: category._id.toString(), title: category.title }));
}
