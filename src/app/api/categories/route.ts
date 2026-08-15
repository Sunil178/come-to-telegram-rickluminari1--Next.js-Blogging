import { NextResponse } from "next/server";
import Category from "@/models/Category";
import { withApiGuard } from "@/libs/api-guard";
import { slugify } from "@/libs/slug";
import { ROLES } from "@/libs/roles";

export const POST = withApiGuard(
    async (request) => {
        try {
            const body = await request.json().catch(() => null);
            const title = (body?.title ?? "").trim();

            if (!title) {
                return NextResponse.json({ data: null, message: "Title is required" }, { status: 400 });
            }

            const category = await Category.create({ title, slug: slugify(title), visibility: true });
            return NextResponse.json({ data: { id: category._id.toString(), title: category.title, slug: category.slug }, message: "Success" });
        } catch (error) {
            if ((error as { code?: number }).code === 11000) {
                return NextResponse.json({ data: null, message: "A category with this name already exists" }, { status: 409 });
            }
            console.error("Failed to create category:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: ROLES.ADMIN }
);
