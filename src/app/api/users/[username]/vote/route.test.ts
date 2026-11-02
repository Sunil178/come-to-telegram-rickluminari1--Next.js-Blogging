import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOneMock = vi.fn();
const findByIdMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: {
        findOne: (...args: unknown[]) => findOneMock(...args),
        findById: (...args: unknown[]) => ({ select: () => ({ lean: () => findByIdMock(...args) }) }),
    },
}));
vi.mock("@/models/UserVote", () => ({ default: { name: "UserVote" } }));

const toggleVoteMock = vi.fn();
vi.mock("@/libs/toggle-vote", () => ({ toggleVote: (...args: unknown[]) => toggleVoteMock(...args) }));

const { POST } = await import("@/app/api/users/[username]/vote/route");

const TARGET = { _id: { toString: () => "target-1" } };

function vote(body: unknown, username = "ananya.iyer") {
    return POST(new NextRequest(`http://localhost/api/users/${username}/vote`, { method: "POST", body: JSON.stringify(body) }), {
        params: Promise.resolve({ username }),
    });
}

describe("POST /api/users/[username]/vote", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "voter-1", role: "reader" } });
        findOneMock.mockReset().mockResolvedValue(TARGET);
        findByIdMock.mockReset().mockResolvedValue({ upvoteCount: 5, downvoteCount: 2 });
        toggleVoteMock.mockReset().mockResolvedValue({ action: "switched", currentType: false, upvoteCount: 5, downvoteCount: 2 });
    });

    it("returns 401 for an unauthenticated request", async () => {
        authMock.mockResolvedValue(null);
        expect((await vote({ type: true })).status).toBe(401);
    });

    it("rejects a non-boolean vote type", async () => {
        expect((await vote({ type: 1 })).status).toBe(400);
    });

    it("returns 404 for an unknown user, looking up the decoded username", async () => {
        findOneMock.mockResolvedValue(null);
        const response = await vote({ type: true }, "some%20one");

        expect(response.status).toBe(404);
        expect(findOneMock).toHaveBeenCalledWith({ username: "some one" });
    });

    it("refuses a vote on your own profile", async () => {
        authMock.mockResolvedValue({ user: { id: "target-1", role: "reader" } });
        expect((await vote({ type: true })).status).toBe(400);
        expect(toggleVoteMock).not.toHaveBeenCalled();
    });

    it("toggles the session user's vote and returns the fresh counts", async () => {
        const response = await vote({ type: false });

        expect(toggleVoteMock).toHaveBeenCalledWith(
            expect.objectContaining({ voteFilter: { userId: "voter-1", targetUserId: TARGET._id }, type: false, voterId: "voter-1" })
        );
        expect(await response.json()).toMatchObject({ data: { action: "switched", myVote: false, upvoteCount: 5, downvoteCount: 2 } });
    });
});
