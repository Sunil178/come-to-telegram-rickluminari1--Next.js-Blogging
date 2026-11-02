import type { FilterQuery, Types } from "mongoose";
import Post, { type IPost } from "@/models/Post";
import Category from "@/models/Category";
import { escapeRegExp } from "@/libs/search-query";
import { logger } from "@/libs/logger";

const MAX_QUERY_LENGTH = 200;
const CARD_FIELDS = "slug title titleDescription bannerImage publishedAt categoryId upvoteCount downvoteCount";
// MongoDB's code when the text index doesn't exist (yet), e.g. while it builds on a fresh deploy.
const INDEX_NOT_FOUND = 27;

export type PostCardDoc = Pick<IPost, "slug" | "title" | "titleDescription" | "bannerImage" | "publishedAt" | "upvoteCount" | "downvoteCount"> & {
    _id: Types.ObjectId;
    categoryId: { title?: string } | null;
};

type Sort = Record<string, 1 | -1 | { $meta: "textScore" }>;
const BY_DATE: Sort = { publishedAt: -1, _id: -1 };

// Cut at a word boundary, so a pasted long query doesn't end in a half word.
function trimQuery(query: string | undefined): string {
    const q = (query ?? "").trim().replace(/\s+/g, " ");
    if (q.length <= MAX_QUERY_LENGTH) return q;
    const cut = q.slice(0, MAX_QUERY_LENGTH + 1);
    return cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : MAX_QUERY_LENGTH);
}

function findPage(match: FilterQuery<IPost>, sort: Sort, page: number, pageSize: number): Promise<PostCardDoc[]> {
    return Post.find(match)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate({ path: "categoryId", model: Category, select: "title" })
        .select(CARD_FIELDS)
        .lean<PostCardDoc[]>();
}

async function pageOf(match: FilterQuery<IPost>, sort: Sort, page: number, pageSize: number) {
    const total = await Post.countDocuments(match);
    return { total, posts: total > 0 ? await findPage(match, sort, page, pageSize) : [] };
}

/**
 * A page of posts matching `filter` and the search words. Words go through the weighted text index
 * (title, tags, description, summary; stemmed, so "databases" finds "database"), ranked by relevance:
 * posts with more of the words, and in their titles, come first. A query that matches no whole word,
 * like a half-typed one, falls back to titles containing every word as typed.
 */
export async function searchPosts(filter: FilterQuery<IPost>, query: string | undefined, page: number, pageSize: number): Promise<{ total: number; posts: PostCardDoc[] }> {
    const q = trimQuery(query);
    if (!q) {
        const [total, posts] = await Promise.all([Post.countDocuments(filter), findPage(filter, BY_DATE, page, pageSize)]);
        return { total, posts };
    }

    try {
        const ranked = await pageOf({ ...filter, $text: { $search: q } }, { score: { $meta: "textScore" }, ...BY_DATE }, page, pageSize);
        if (ranked.total > 0) return ranked;
    } catch (error) {
        if ((error as { code?: number }).code !== INDEX_NOT_FOUND) throw error;
        logger.warn("Posts search text index is missing; searching titles only");
    }
    const titleHasEveryWord = q.split(" ").map((word) => ({ title: { $regex: escapeRegExp(word), $options: "i" } }));
    return pageOf({ ...filter, $and: titleHasEveryWord }, BY_DATE, page, pageSize);
}
