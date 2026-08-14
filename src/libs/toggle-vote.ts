import type { Types } from "mongoose";

interface VoteDocument {
    type: boolean;
    delete: (deletedBy?: string) => Promise<unknown>;
    save: () => Promise<unknown>;
}

export type VoteAction = "created" | "removed" | "switched";

export interface VoteResult {
    action: VoteAction;
    currentType: boolean | null;
}

interface ToggleVoteOptions {
    // Typed loosely: mongoose's Model<T, ...> generic has enough type
    // parameters that a precise type here fights variance for no benefit —
    // the actual safety comes from the VoteDocument cast on the result.
    voteModel: any;
    voteFilter: Record<string, unknown>;
    counterModel: any;
    counterId: Types.ObjectId | string;
    type: boolean;
    voterId: string;
}

/**
 * Shared toggle/switch semantics for post, comment, and user votes:
 * no existing vote creates one; voting the same type again removes it
 * (toggle off); voting the opposite type switches it. Each branch keeps
 * the target document's denormalized upvoteCount/downvoteCount in sync
 * via $inc in the same request — not a separate reconciliation job.
 */
export async function toggleVote({
    voteModel,
    voteFilter,
    counterModel,
    counterId,
    type,
    voterId,
}: ToggleVoteOptions): Promise<VoteResult> {
    const existing = (await voteModel.findOne(voteFilter)) as VoteDocument | null;

    if (!existing) {
        await voteModel.create({ ...voteFilter, type });
        await counterModel.updateOne(
            { _id: counterId },
            { $inc: { [type ? "upvoteCount" : "downvoteCount"]: 1 } }
        );
        return { action: "created", currentType: type };
    }

    if (existing.type === type) {
        await existing.delete(voterId);
        await counterModel.updateOne(
            { _id: counterId },
            { $inc: { [type ? "upvoteCount" : "downvoteCount"]: -1 } }
        );
        return { action: "removed", currentType: null };
    }

    existing.type = type;
    await existing.save();
    await counterModel.updateOne(
        { _id: counterId },
        { $inc: { upvoteCount: type ? 1 : -1, downvoteCount: type ? -1 : 1 } }
    );
    return { action: "switched", currentType: type };
}
