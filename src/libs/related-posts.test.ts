import { beforeEach, describe, expect, it, vi } from "vitest";

const aggregateMock = vi.fn();
vi.mock("@/models/Post", () => ({ default: { aggregate: (...args: unknown[]) => aggregateMock(...args) } }));

const { findRelatedPosts } = await import("@/libs/related-posts");

describe("findRelatedPosts", () => {
    beforeEach(() => aggregateMock.mockReset().mockResolvedValue([]));

    it("matches public posts sharing a tag or the category, excluding the post itself, ranked by overlap", async () => {
        await findRelatedPosts({ _id: "p1" as never, tags: ["AI", "$where"], categoryId: "c1" as never });

        const [pipeline] = aggregateMock.mock.calls[0];
        expect(pipeline[0].$match).toMatchObject({
            approval: "Approved",
            published: true,
            visibility: true,
            _id: { $ne: "p1" },
            $or: [{ tags: { $in: ["AI", "$where"] } }, { categoryId: "c1" }],
        });
        expect(pipeline[1].$addFields.sharedTags.$size.$setIntersection[1]).toEqual({ $literal: ["AI", "$where"] });
        expect(pipeline[2].$sort).toEqual({ sharedTags: -1, sameCategory: -1, publishedAt: -1 });
        expect(pipeline[3].$limit).toBe(3);
    });

    it("doesn't boost uncategorised posts when the post itself has no category", async () => {
        await findRelatedPosts({ _id: "p1" as never, tags: ["AI"], categoryId: null });
        expect(aggregateMock.mock.calls[0][0][1].$addFields.sameCategory).toBe(0);
    });

    it("returns nothing without tags or a category to relate by", async () => {
        expect(await findRelatedPosts({ _id: "p1" as never, tags: [], categoryId: null })).toEqual([]);
        expect(aggregateMock).not.toHaveBeenCalled();
    });
});
