import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: (fn: () => unknown) => fn() };
});
const notifyMock = vi.fn();
vi.mock("@/libs/notify", () => ({ notify: (...args: unknown[]) => notifyMock(...args) }));

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const commentFindByIdMock = vi.fn();
const commentCountsMock = vi.fn();
vi.mock("@/models/Comment", () => ({
    default: {
        findById: (...args: unknown[]) => {
            const result = commentFindByIdMock(...args);
            return Object.assign(Promise.resolve(result), { select: () => ({ lean: () => commentCountsMock() }) });
        },
    },
}));
const postFindByIdMock = vi.fn();
vi.mock("@/models/Post", () => ({ default: { findById: (...args: unknown[]) => postFindByIdMock(...args) } }));
vi.mock("@/models/CommentVote", () => ({ default: { name: "CommentVote" } }));

const toggleVoteMock = vi.fn();
vi.mock("@/libs/toggle-vote", () => ({ toggleVote: (...args: unknown[]) => toggleVoteMock(...args) }));

const { POST } = await import("@/app/api/comments/[id]/vote/route");

const COMMENT_ID = "6500000000000000000000c1";
const PUBLIC_POST = { _id: "post-1", userId: "author-1", approval: "Approved", published: true, visibility: true };

function vote(body: unknown, id = COMMENT_ID) {
    return POST(new NextRequest(`http://localhost/api/comments/${id}/vote`, { method: "POST", body: JSON.stringify(body) }), {
        params: Promise.resolve({ id }),
    });
}

describe("POST /api/comments/[id]/vote", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "voter-1", role: "reader" } });
        commentFindByIdMock.mockReset().mockReturnValue({ _id: COMMENT_ID, postId: "post-1" });
        commentCountsMock.mockReset().mockResolvedValue({ upvoteCount: 2, downvoteCount: 0 });
        postFindByIdMock.mockReset().mockResolvedValue(PUBLIC_POST);
        toggleVoteMock.mockReset().mockResolvedValue({ action: "removed", currentType: null, upvoteCount: 2, downvoteCount: 0 });
        notifyMock.mockReset();
    });

    it("returns 400 for a malformed comment id", async () => {
        expect((await vote({ type: true }, "nope")).status).toBe(400);
    });

    it("rejects a non-boolean vote type", async () => {
        expect((await vote({})).status).toBe(400);
    });

    it("returns 404 for a missing comment", async () => {
        commentFindByIdMock.mockReturnValue(null);
        expect((await vote({ type: true })).status).toBe(404);
    });

    it("hides comments on a post that isn't publicly visible from non-owners", async () => {
        postFindByIdMock.mockResolvedValue({ ...PUBLIC_POST, visibility: false });
        expect((await vote({ type: true })).status).toBe(404);
        expect(toggleVoteMock).not.toHaveBeenCalled();
    });

    it("toggles the session user's vote and returns the fresh counts", async () => {
        const response = await vote({ type: true });

        expect(toggleVoteMock).toHaveBeenCalledWith(
            expect.objectContaining({ voteFilter: { userId: "voter-1", commentId: COMMENT_ID }, counterId: COMMENT_ID, type: true })
        );
        expect(await response.json()).toMatchObject({ data: { action: "removed", myVote: null, upvoteCount: 2, downvoteCount: 0 } });
    });

    it("notifies the comment's author of an upvote, and not of a removal", async () => {
        commentFindByIdMock.mockReturnValue({ _id: COMMENT_ID, postId: "post-1", userId: "commenter-1" });
        await vote({ type: true });
        expect(notifyMock).not.toHaveBeenCalled();

        toggleVoteMock.mockResolvedValue({ action: "created", currentType: true, upvoteCount: 2, downvoteCount: 0 });
        await vote({ type: true });
        expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "commenter-1", type: "comment_upvoted", commentId: COMMENT_ID }));
    });
});
