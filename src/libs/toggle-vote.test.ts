import { describe, expect, it, vi } from "vitest";
import { toggleVote } from "@/libs/toggle-vote";

function makeCounterModel() {
    return { updateOne: vi.fn().mockResolvedValue(undefined) };
}

// countDocuments answers with the target's live votes after the change: up first, then down.
function countsOf(up: number, down: number) {
    return vi.fn((filter: { type: boolean }) => Promise.resolve(filter.type ? up : down));
}

const base = { voteFilter: { userId: "u1", postId: "p1" }, targetFilter: { postId: "p1" }, counterId: "p1", voterId: "u1" };

describe("toggleVote", () => {
    it("creates a new vote and stores the target's recounted totals", async () => {
        const voteModel = { findOne: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(undefined), countDocuments: countsOf(3, 1) };
        const counterModel = makeCounterModel();

        const result = await toggleVote({ ...base, voteModel, counterModel, type: true });

        expect(result).toEqual({ action: "created", currentType: true, upvoteCount: 3, downvoteCount: 1 });
        expect(voteModel.create).toHaveBeenCalledWith({ userId: "u1", postId: "p1", type: true });
        expect(voteModel.countDocuments).toHaveBeenCalledWith({ postId: "p1", type: true });
        expect(voteModel.countDocuments).toHaveBeenCalledWith({ postId: "p1", type: false });
        expect(counterModel.updateOne).toHaveBeenCalledWith({ _id: "p1" }, { $set: { upvoteCount: 3, downvoteCount: 1 } });
    });

    it("removes the vote when voting the same type again", async () => {
        const existing = { type: true, delete: vi.fn().mockResolvedValue(undefined), save: vi.fn() };
        const voteModel = { findOne: vi.fn().mockResolvedValue(existing), countDocuments: countsOf(0, 0) };
        const counterModel = makeCounterModel();

        const result = await toggleVote({ ...base, voteModel, counterModel, type: true });

        expect(result).toEqual({ action: "removed", currentType: null, upvoteCount: 0, downvoteCount: 0 });
        expect(existing.delete).toHaveBeenCalledWith("u1");
        expect(counterModel.updateOne).toHaveBeenCalledWith({ _id: "p1" }, { $set: { upvoteCount: 0, downvoteCount: 0 } });
    });

    it("switches the vote when voting the opposite type", async () => {
        const existing = { type: true, delete: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
        const voteModel = { findOne: vi.fn().mockResolvedValue(existing), countDocuments: countsOf(1, 1) };
        const counterModel = makeCounterModel();

        const result = await toggleVote({ ...base, voteModel, counterModel, type: false });

        expect(result).toEqual({ action: "switched", currentType: false, upvoteCount: 1, downvoteCount: 1 });
        expect(existing.type).toBe(false);
        expect(existing.save).toHaveBeenCalled();
    });

    it("corrects a counter that had drifted from the vote records", async () => {
        const voteModel = { findOne: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(undefined), countDocuments: countsOf(1, 0) };
        const counterModel = makeCounterModel();

        await toggleVote({ ...base, voteModel, counterModel, type: true });

        // Whatever the stored counter said before, it ends equal to the records.
        expect(counterModel.updateOne).toHaveBeenCalledWith({ _id: "p1" }, { $set: { upvoteCount: 1, downvoteCount: 0 } });
    });

    it("treats a concurrent duplicate create of the same vote as already recorded", async () => {
        const existing = { type: true, delete: vi.fn().mockResolvedValue(undefined), save: vi.fn() };
        const voteModel = {
            findOne: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
            create: vi.fn().mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 })),
            countDocuments: countsOf(1, 0),
        };
        const counterModel = makeCounterModel();

        const result = await toggleVote({ ...base, voteModel, counterModel, type: true });

        // The other request already recorded this vote; this click must not remove it.
        expect(result).toEqual({ action: "created", currentType: true, upvoteCount: 1, downvoteCount: 0 });
        expect(existing.delete).not.toHaveBeenCalled();
        expect(existing.save).not.toHaveBeenCalled();
    });

    it("switches a concurrently created opposite vote to the one this click asked for", async () => {
        const existing = { type: false, delete: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
        const voteModel = {
            findOne: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existing),
            create: vi.fn().mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 })),
            countDocuments: countsOf(1, 0),
        };

        const result = await toggleVote({ ...base, voteModel, counterModel: makeCounterModel(), type: true });

        expect(result).toMatchObject({ action: "switched", currentType: true });
        expect(existing.type).toBe(true);
        expect(existing.save).toHaveBeenCalled();
    });

    it("recounts again when a concurrent vote changed the records after this count", async () => {
        // First count sees 1 up; by the check after the write, another vote made it 2.
        let counts = 0;
        const countDocuments = vi.fn((filter: { type: boolean }) => Promise.resolve(filter.type ? (++counts > 1 ? 2 : 1) : 0));
        const voteModel = { findOne: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(undefined), countDocuments };
        const counterModel = makeCounterModel();

        const result = await toggleVote({ ...base, voteModel, counterModel, type: true });

        expect(result).toMatchObject({ upvoteCount: 2, downvoteCount: 0 });
        expect(counterModel.updateOne).toHaveBeenLastCalledWith({ _id: "p1" }, { $set: { upvoteCount: 2, downvoteCount: 0 } });
    });
});
