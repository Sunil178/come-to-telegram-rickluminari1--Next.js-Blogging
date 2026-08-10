import { NextRequest, NextResponse } from "next/server";
import User from "@/models/User";           // Register User model
import Category from "@/models/Category";   // Register Category model
import Post from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "ascend" ? 1 : -1;
    const search = searchParams.get("search") || "";
    const approval = searchParams.get("approval");
    const published = searchParams.get("published");

    const filter: any = {};

    if (search) {
        filter.title = { $regex: search, $options: "i" };
    }

    if (approval) {
        filter.approval = parseInt(approval, 10);
    }

    if (published) {
        filter.published = published === "true";
    }

    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
        .populate({ path: "userId", model: User, select: "email username name" })
        .populate({ path: "categoryId", model: Category, select: "title slug" })
        .sort({ [sortField]: sortOrder })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean();

    return NextResponse.json({ data: posts, total, message: "Success" });
}
export const POST = withApiGuard(async (request, { session }) => {
    try {
        const body = await request.formData();
        if (!body.has('post_data')) {
            return NextResponse.json({ data: null, message: 'Post page data is required' }, { status: 400 });
        }

        await Post.create({
            'userId': session.user.id,
            'slug': body.get('slug'),
            'title': body.get('title'),
            'titleDescription': body.get('titleDescription'),
            'tags': (body.get('tags') as string)?.split(','),
            'bannerImage': body.get('postBannerPath'),
            'content': body.get('post_data'),
        })
        return NextResponse.redirect(new URL('/posts', request.url))
    } catch (error) {
        console.error('Failed to create post:', error);
        return NextResponse.json({ data: null, message: 'Something went wrong' }, { status: 500 });
    }
});
