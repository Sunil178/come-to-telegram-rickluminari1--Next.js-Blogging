import { beforeEach, describe, expect, it, vi } from "vitest";

const aggregateMock = vi.fn();
vi.mock("@/models/Post", () => ({ default: { aggregate: (...args: unknown[]) => aggregateMock(...args), collection: { name: "posts" } } }));

const { findRelatedPosts } = await import("@/libs/related-posts");

describe("findRelatedPosts", () => {
    beforeEach(() => aggregateMock.mockReset().mockResolvedValue([]));

    it("scores the newest tag matches and the newest same-category posts, excluding the post itself, ranked by overlap", async () => {
        await findRelatedPosts({ _id: "p1" as never, tags: ["AI", "$where"], categoryId: "c1" as never });

        const [pipeline] = aggregateMock.mock.calls[0];
        const visible = { approval: "Approved", published: true, visibility: true, _id: { $ne: "p1" }, deleted: { $ne: true } };
        expect(pipeline[0].$match).toMatchObject({ ...visible, tags: { $in: ["AI", "$where"] } });
        // Each candidate set is capped separately, so recent same-category posts can't crowd out tag matches.
        expect(pipeline.slice(1, 3)).toEqual([{ $sort: { publishedAt: -1, _id: -1 } }, { $limit: 200 }]);
        expect(pipeline[3].$unionWith.coll).toBe("posts");
        expect(pipeline[3].$unionWith.pipeline[0].$match).toMatchObject({ ...visible, categoryId: "c1" });
        expect(pipeline[3].$unionWith.pipeline.slice(1)).toEqual([{ $sort: { publishedAt: -1, _id: -1 } }, { $limit: 200 }]);
        expect(pipeline[4]).toEqual({ $group: { _id: "$_id", doc: { $first: "$$ROOT" } } });
        expect(pipeline[6].$addFields.sharedTags.$size.$setIntersection[1]).toEqual({ $literal: ["AI", "$where"] });
        expect(pipeline[7].$sort).toEqual({ sharedTags: -1, sameCategory: -1, publishedAt: -1, _id: -1 });
        expect(pipeline[8].$limit).toBe(3);
    });

    it("doesn't boost uncategorised posts when the post itself has no category", async () => {
        await findRelatedPosts({ _id: "p1" as never, tags: ["AI"], categoryId: null });
        expect(aggregateMock.mock.calls[0][0][3].$addFields.sameCategory).toBe(0);
    });

    it("returns nothing without tags or a category to relate by", async () => {
        expect(await findRelatedPosts({ _id: "p1" as never, tags: [], categoryId: null })).toEqual([]);
        expect(aggregateMock).not.toHaveBeenCalled();
    });
});
