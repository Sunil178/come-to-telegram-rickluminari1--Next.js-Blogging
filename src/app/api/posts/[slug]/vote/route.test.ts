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

const findOneMock = vi.fn();
const findByIdMock = vi.fn();
vi.mock("@/models/Post", () => ({
    default: {
        findOne: (...args: unknown[]) => findOneMock(...args),
        findById: (...args: unknown[]) => ({ select: () => ({ lean: () => findByIdMock(...args) }) }),
    },
}));
vi.mock("@/models/PostVote", () => ({ default: { name: "PostVote" } }));

const toggleVoteMock = vi.fn();
vi.mock("@/libs/toggle-vote", () => ({ toggleVote: (...args: unknown[]) => toggleVoteMock(...args) }));

const { POST } = await import("@/app/api/posts/[slug]/vote/route");

const PUBLIC_POST = { _id: "post-1", userId: "author-1", approval: "Approved", published: true, visibility: true, publishedAt: new Date("2026-01-01T00:00:00Z") };

function vote(body: unknown) {
    return POST(new NextRequest("http://localhost/api/posts/p/vote", { method: "POST", body: JSON.stringify(body) }), {
        params: Promise.resolve({ slug: "p" }),
    });
}

describe("POST /api/posts/[slug]/vote", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "voter-1", role: "reader" } });
        findOneMock.mockReset().mockResolvedValue(PUBLIC_POST);
        findByIdMock.mockReset().mockResolvedValue({ upvoteCount: 3, downvoteCount: 1 });
        toggleVoteMock.mockReset().mockResolvedValue({ action: "created", currentType: true, upvoteCount: 3, downvoteCount: 1 });
        notifyMock.mockReset();
    });

    it("returns 401 for an unauthenticated request", async () => {
        authMock.mockResolvedValue(null);
        expect((await vote({ type: true })).status).toBe(401);
        expect(toggleVoteMock).not.toHaveBeenCalled();
    });

    it("rejects a non-boolean vote type", async () => {
        expect((await vote({ type: "up" })).status).toBe(400);
    });

    it("returns 404 for a missing post", async () => {
        findOneMock.mockResolvedValue(null);
        expect((await vote({ type: true })).status).toBe(404);
    });

    it("hides an unpublished post from non-owners", async () => {
        findOneMock.mockResolvedValue({ ...PUBLIC_POST, approval: "Pending" });
        expect((await vote({ type: true })).status).toBe(404);
        expect(toggleVoteMock).not.toHaveBeenCalled();
    });

    it("lets the owner vote on their own unpublished post", async () => {
        authMock.mockResolvedValue({ user: { id: "author-1", role: "author" } });
        findOneMock.mockResolvedValue({ ...PUBLIC_POST, published: false });
        expect((await vote({ type: true })).status).toBe(200);
    });

    it("toggles the session user's vote and returns the fresh counts", async () => {
        const response = await vote({ type: false });

        expect(toggleVoteMock).toHaveBeenCalledWith(
            expect.objectContaining({ voteFilter: { userId: "voter-1", postId: "post-1" }, counterId: "post-1", type: false, voterId: "voter-1" })
        );
        expect(await response.json()).toMatchObject({ data: { action: "created", myVote: true, upvoteCount: 3, downvoteCount: 1 } });
    });

    it("notifies the author of a new or switched-to upvote, deduplicated per voter", async () => {
        await vote({ type: true });
        expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "author-1", actorId: "voter-1", type: "post_upvoted", postId: "post-1" }));

        notifyMock.mockReset();
        toggleVoteMock.mockResolvedValue({ action: "switched", currentType: true, upvoteCount: 3, downvoteCount: 1 });
        await vote({ type: true });
        expect(notifyMock).toHaveBeenCalledTimes(1);
    });

    it("doesn't notify for downvotes or removed votes", async () => {
        toggleVoteMock.mockResolvedValue({ action: "created", currentType: false, upvoteCount: 3, downvoteCount: 1 });
        await vote({ type: false });
        toggleVoteMock.mockResolvedValue({ action: "removed", currentType: null, upvoteCount: 3, downvoteCount: 1 });
        await vote({ type: true });
        expect(notifyMock).not.toHaveBeenCalled();
    });
});
