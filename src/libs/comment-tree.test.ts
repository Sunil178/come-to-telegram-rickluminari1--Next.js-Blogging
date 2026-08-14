import { describe, expect, it } from "vitest";
import { buildCommentTree, type FlatComment } from "@/libs/comment-tree";

function comment(overrides: Partial<FlatComment> & { _id: string }): FlatComment {
    return {
        postId: "post-1",
        parentId: null,
        userId: { _id: "user-1", username: "alice" },
        content: "hello",
        upvoteCount: 0,
        downvoteCount: 0,
        editedAt: null,
        deleted: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ...overrides,
    };
}

describe("buildCommentTree", () => {
    it("nests replies under their parent", () => {
        const tree = buildCommentTree([
            comment({ _id: "a" }),
            comment({ _id: "b", parentId: "a" }),
            comment({ _id: "c", parentId: "b" }),
        ]);

        expect(tree).toHaveLength(1);
        expect(tree[0].id).toBe("a");
        expect(tree[0].replies[0].id).toBe("b");
        expect(tree[0].replies[0].replies[0].id).toBe("c");
    });

    it("drops a soft-deleted leaf comment entirely", () => {
        const tree = buildCommentTree([comment({ _id: "a" }), comment({ _id: "b", deleted: true })]);

        expect(tree.map((n) => n.id)).toEqual(["a"]);
    });

    it("keeps a soft-deleted comment as a tombstone when it still has surviving replies", () => {
        const tree = buildCommentTree([
            comment({ _id: "a", deleted: true }),
            comment({ _id: "b", parentId: "a" }),
        ]);

        expect(tree).toHaveLength(1);
        expect(tree[0]).toMatchObject({ id: "a", deleted: true, content: "" });
        expect(tree[0].replies).toHaveLength(1);
    });

    it("prunes a deleted comment whose only replies were themselves pruned", () => {
        const tree = buildCommentTree([
            comment({ _id: "a", deleted: true }),
            comment({ _id: "b", parentId: "a", deleted: true }),
        ]);

        expect(tree).toEqual([]);
    });

    it("extracts author id/username from a populated userId, and falls back to id-only for an unpopulated one", () => {
        const tree = buildCommentTree([
            comment({ _id: "a", userId: { _id: "user-1", username: "alice" } }),
            comment({ _id: "b", userId: "user-2" }),
        ]);

        expect(tree[0]).toMatchObject({ authorId: "user-1", authorUsername: "alice" });
        expect(tree[1]).toMatchObject({ authorId: "user-2", authorUsername: null });
    });

    it("attaches the caller's own vote from the myVotes map", () => {
        const tree = buildCommentTree(
            [comment({ _id: "a" }), comment({ _id: "b" })],
            new Map([["a", true]])
        );

        expect(tree.find((n) => n.id === "a")?.myVote).toBe(true);
        expect(tree.find((n) => n.id === "b")?.myVote).toBeNull();
    });
});
