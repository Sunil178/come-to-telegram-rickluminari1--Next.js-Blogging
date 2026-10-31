import type { Types } from "mongoose";
import Post from "@/models/Post";
import { publicPostFilter } from "@/libs/post-visibility";

export interface RelatedPost {
    slug: string;
    title: string;
    titleDescription?: string;
    publishedAt?: Date | null;
}

interface Source {
    _id: Types.ObjectId;
    tags?: string[];
    categoryId?: Types.ObjectId | null;
}

// Public posts ranked by shared tags, then same category, then recency.
export async function findRelatedPosts(post: Source, limit = 3): Promise<RelatedPost[]> {
    const tags = post.tags ?? [];
    const candidates: object[] = [];
    if (tags.length) candidates.push({ tags: { $in: tags } });
    if (post.categoryId) candidates.push({ categoryId: post.categoryId });
    if (!candidates.length) return [];

    return Post.aggregate<RelatedPost>([
        { $match: { ...publicPostFilter(), _id: { $ne: post._id }, $or: candidates } },
        {
            $addFields: {
                // $literal: a tag starting with "$" would otherwise be read as a field path.
                sharedTags: { $size: { $setIntersection: [{ $ifNull: ["$tags", []] }, { $literal: tags }] } },
                sameCategory: post.categoryId ? { $cond: [{ $eq: ["$categoryId", post.categoryId] }, 1, 0] } : 0,
            },
        },
        { $sort: { sharedTags: -1, sameCategory: -1, publishedAt: -1 } },
        { $limit: limit },
        { $project: { _id: 0, slug: 1, title: 1, titleDescription: 1, publishedAt: 1 } },
    ]);
}
