import { beforeEach, describe, expect, it, vi } from "vitest";

const countMock = vi.fn();
const findCalls: { filter: unknown; sort?: unknown; skip?: number; limit?: number }[] = [];
vi.mock("@/models/Post", () => ({
    default: {
        countDocuments: (filter: unknown) => countMock(filter),
        find: (filter: unknown) => {
            const call: (typeof findCalls)[number] = { filter };
            findCalls.push(call);
            const query = {
                sort: (sort: unknown) => ((call.sort = sort), query),
                skip: (skip: number) => ((call.skip = skip), query),
                limit: (limit: number) => ((call.limit = limit), query),
                populate: () => query,
                select: () => query,
                lean: async () => [{ slug: "found" }],
            };
            return query;
        },
    },
}));
vi.mock("@/models/Category", () => ({ default: {} }));

const { searchPosts } = await import("@/libs/post-search");

const BASE = { approval: "Approved" };

describe("searchPosts", () => {
    beforeEach(() => {
        countMock.mockReset();
        findCalls.length = 0;
    });

    it("lists newest first without a query", async () => {
        countMock.mockResolvedValue(12);
        expect(await searchPosts(BASE, "  ", 2, 9)).toEqual({ total: 12, posts: [{ slug: "found" }] });
        expect(findCalls).toEqual([{ filter: BASE, sort: { publishedAt: -1, _id: -1 }, skip: 9, limit: 9 }]);
    });

    it("ranks word matches by relevance through the text index, fetching a page only when there are hits", async () => {
        countMock.mockResolvedValue(3);
        await searchPosts(BASE, " rust   async ", 1, 9);
        expect(findCalls).toEqual([{ filter: { ...BASE, $text: { $search: "rust async" } }, sort: { score: { $meta: "textScore" }, publishedAt: -1, _id: -1 }, skip: 0, limit: 9 }]);
    });

    it("falls back to titles containing every word as typed when no whole word matches", async () => {
        countMock.mockImplementation(async (filter: Record<string, unknown>) => ("$text" in filter ? 0 : 1));
        expect((await searchPosts(BASE, "welcome sui(", 1, 9)).total).toBe(1);
        expect(findCalls).toHaveLength(1);
        expect(findCalls[0].filter).toEqual({ ...BASE, $and: [{ title: { $regex: "welcome", $options: "i" } }, { title: { $regex: "sui\\(", $options: "i" } }] });
    });

    it("searches titles when the text index doesn't exist yet, and passes other errors on", async () => {
        countMock.mockImplementation(async (filter: Record<string, unknown>) => {
            if ("$text" in filter) throw Object.assign(new Error("text index required for $text query"), { code: 27 });
            return 2;
        });
        expect((await searchPosts(BASE, "welcome", 1, 9)).total).toBe(2);

        countMock.mockRejectedValue(Object.assign(new Error("network"), { code: 6 }));
        await expect(searchPosts(BASE, "welcome", 1, 9)).rejects.toThrow("network");
    });

    it("cuts a long query at a word boundary", async () => {
        countMock.mockResolvedValue(1);
        await searchPosts(BASE, `${"word ".repeat(39)}configuration`, 1, 9);
        const search = (findCalls[0].filter as { $text: { $search: string } }).$text.$search;
        expect(search.length).toBeLessThanOrEqual(200);
        expect(search.endsWith("word")).toBe(true);
    });
});
