import type { PipelineStage, Types } from "mongoose";
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

// Candidates scored per post: the newest this many sharing a tag, plus the newest this many in the
// same category, taken separately so recent same-category posts can't crowd out strong tag matches.
const CANDIDATES = 200;

// Public posts ranked by shared tags, then same category, then recency.
export async function findRelatedPosts(post: Source, limit = 3): Promise<RelatedPost[]> {
    const tags = post.tags ?? [];
    // The soft-delete condition is spelled out because the plugin doesn't reach into $unionWith.
    const base = { ...publicPostFilter(), _id: { $ne: post._id }, deleted: { $ne: true } };
    const newest: (PipelineStage.Sort | PipelineStage.Limit)[] = [{ $sort: { publishedAt: -1, _id: -1 } }, { $limit: CANDIDATES }];
    const byTag: (PipelineStage.Match | PipelineStage.Sort | PipelineStage.Limit)[] | null = tags.length ? [{ $match: { ...base, tags: { $in: tags } } }, ...newest] : null;
    const byCategory: (PipelineStage.Match | PipelineStage.Sort | PipelineStage.Limit)[] | null = post.categoryId ? [{ $match: { ...base, categoryId: post.categoryId } }, ...newest] : null;
    if (!byTag && !byCategory) return [];

    const candidates: PipelineStage[] =
        byTag && byCategory
            ? [...byTag, { $unionWith: { coll: Post.collection.name, pipeline: byCategory } }, { $group: { _id: "$_id", doc: { $first: "$$ROOT" } } }, { $replaceRoot: { newRoot: "$doc" } }]
            : (byTag ?? byCategory)!;

    return Post.aggregate<RelatedPost>([
        ...candidates,
        {
            $addFields: {
                // $literal: a tag starting with "$" would otherwise be read as a field path.
                sharedTags: { $size: { $setIntersection: [{ $ifNull: ["$tags", []] }, { $literal: tags }] } },
                sameCategory: post.categoryId ? { $cond: [{ $eq: ["$categoryId", post.categoryId] }, 1, 0] } : 0,
            },
        },
        { $sort: { sharedTags: -1, sameCategory: -1, publishedAt: -1, _id: -1 } },
        { $limit: limit },
        { $project: { _id: 0, slug: 1, title: 1, titleDescription: 1, publishedAt: 1 } },
    ]);
}
