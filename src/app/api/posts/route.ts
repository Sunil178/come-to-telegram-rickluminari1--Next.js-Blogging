import { NextRequest, NextResponse } from "next/server";
import User from "@/models/User";           // Register User model
import Category from "@/models/Category";   // Register Category model
import Post, { ApprovalStatus } from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";
import { escapeRegExp } from "@/libs/search-query";
import { slugify } from "@/libs/slug";
import { parsePostEditorValue, serializePostContent } from "@/libs/post-editor-serialize";

export const GET = withApiGuard(async (request: NextRequest) => {
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
        filter.title = { $regex: escapeRegExp(search), $options: "i" };
    }

    if (approval && Object.values(ApprovalStatus).includes(approval as ApprovalStatus)) {
        filter.approval = approval;
    }

    if (published) {
        filter.published = published === "true";
    }

    const [total, posts] = await Promise.all([
        Post.countDocuments(filter),
        Post.find(filter)
            .populate({ path: "userId", model: User, select: "email username name" })
            .populate({ path: "categoryId", model: Category, select: "title slug" })
            .sort({ [sortField]: sortOrder })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .lean(),
    ]);

    return NextResponse.json({ data: posts, total, message: "Success" });
});

export const POST = withApiGuard(async (request, { session }) => {
    try {
        const body = await request.formData();

        const title = (body.get('title') as string || '').trim();
        if (!title) {
            return NextResponse.json({ data: null, message: 'Title is required' }, { status: 400 });
        }

        const slug = ((body.get('slug') as string) || '').trim() || slugify(title);
        if (!slug) {
            return NextResponse.json({ data: null, message: 'Slug is required' }, { status: 400 });
        }

        const value = parsePostEditorValue(body.get('post_data'));
        if (!value) {
            return NextResponse.json({ data: null, message: 'Post content is required' }, { status: 400 });
        }

        const post = await Post.create({
            'userId': session.user.id,
            'slug': slug,
            'title': title,
            'titleDescription': body.get('titleDescription'),
            'tags': (body.get('tags') as string)?.split(',').filter(Boolean) ?? [],
            'bannerImage': body.get('postBannerPath'),
            'content': await serializePostContent(value),
        })
        return NextResponse.json({ data: { slug: post.slug }, message: 'Success' });
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            return NextResponse.json({ data: null, message: 'A post with this slug already exists. Please choose a different slug.' }, { status: 409 });
        }
        console.error('Failed to create post:', error);
        return NextResponse.json({ data: null, message: 'Something went wrong' }, { status: 500 });
    }
});
