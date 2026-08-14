import { describe, expect, it, vi } from "vitest";
import { toggleVote } from "@/libs/toggle-vote";

function makeCounterModel() {
    return { updateOne: vi.fn().mockResolvedValue(undefined) };
}

describe("toggleVote", () => {
    it("creates a new vote and increments the matching counter when none exists", async () => {
        const voteModel = { findOne: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(undefined) };
        const counterModel = makeCounterModel();

        const result = await toggleVote({
            voteModel,
            voteFilter: { userId: "u1", postId: "p1" },
            counterModel,
            counterId: "p1",
            type: true,
            voterId: "u1",
        });

        expect(result).toEqual({ action: "created", currentType: true });
        expect(voteModel.create).toHaveBeenCalledWith({ userId: "u1", postId: "p1", type: true });
        expect(counterModel.updateOne).toHaveBeenCalledWith({ _id: "p1" }, { $inc: { upvoteCount: 1 } });
    });

    it("removes the vote and decrements the counter when voting the same type again", async () => {
        const existing = { type: true, delete: vi.fn().mockResolvedValue(undefined), save: vi.fn() };
        const voteModel = { findOne: vi.fn().mockResolvedValue(existing) };
        const counterModel = makeCounterModel();

        const result = await toggleVote({
            voteModel,
            voteFilter: { userId: "u1", postId: "p1" },
            counterModel,
            counterId: "p1",
            type: true,
            voterId: "u1",
        });

        expect(result).toEqual({ action: "removed", currentType: null });
        expect(existing.delete).toHaveBeenCalledWith("u1");
        expect(counterModel.updateOne).toHaveBeenCalledWith({ _id: "p1" }, { $inc: { upvoteCount: -1 } });
    });

    it("switches the vote and moves both counters when voting the opposite type", async () => {
        const existing = { type: true, delete: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
        const voteModel = { findOne: vi.fn().mockResolvedValue(existing) };
        const counterModel = makeCounterModel();

        const result = await toggleVote({
            voteModel,
            voteFilter: { userId: "u1", postId: "p1" },
            counterModel,
            counterId: "p1",
            type: false,
            voterId: "u1",
        });

        expect(result).toEqual({ action: "switched", currentType: false });
        expect(existing.type).toBe(false);
        expect(existing.save).toHaveBeenCalled();
        expect(counterModel.updateOne).toHaveBeenCalledWith(
            { _id: "p1" },
            { $inc: { upvoteCount: -1, downvoteCount: 1 } }
        );
    });
});
