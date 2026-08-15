import { NextResponse } from "next/server";
import type { SoftDeleteModel } from "mongoose-delete";
import Category, { ICategory } from "@/models/Category";
import Post from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";
import { slugify } from "@/libs/slug";

const SoftDeleteCategory = Category as unknown as SoftDeleteModel<ICategory>;

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(
    async (request, { params }) => {
        try {
            const { id } = await params;
            const body = await request.json().catch(() => null);
            const title = (body?.title ?? "").trim();

            if (!title) {
                return NextResponse.json({ data: null, message: "Title is required" }, { status: 400 });
            }

            const category = await Category.findOneAndUpdate({ _id: id }, { title, slug: slugify(title) }, { new: true });
            if (!category) {
                return NextResponse.json({ data: null, message: "Category not found" }, { status: 404 });
            }

            return NextResponse.json({ data: { id: category._id.toString(), title: category.title, slug: category.slug }, message: "Success" });
        } catch (error) {
            if ((error as { code?: number }).code === 11000) {
                return NextResponse.json({ data: null, message: "A category with this name already exists" }, { status: 409 });
            }
            console.error("Failed to update category:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "admin" }
);

export const DELETE = withApiGuard<RouteContext>(
    async (request, { params, session }) => {
        try {
            const { id } = await params;

            const inUse = await Post.exists({ categoryId: id });
            if (inUse) {
                return NextResponse.json({ data: null, message: "Reassign or remove this category's posts first" }, { status: 400 });
            }

            const result = (await SoftDeleteCategory.delete({ _id: id }, session.user.id)) as unknown as { matchedCount: number };
            if (result.matchedCount === 0) {
                return NextResponse.json({ data: null, message: "Category not found" }, { status: 404 });
            }

            return NextResponse.json({ data: null, message: "Success" });
        } catch (error) {
            console.error("Failed to delete category:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "admin" }
);
