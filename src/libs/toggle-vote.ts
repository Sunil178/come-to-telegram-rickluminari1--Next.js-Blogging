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
    upvoteCount: number;
    downvoteCount: number;
}

interface ToggleVoteOptions {
    // Typed loosely: mongoose's Model<T, ...> generic has enough type
    // parameters that a precise type here fights variance for no benefit —
    // the actual safety comes from the VoteDocument cast on the result.
    voteModel: any;
    // The voter's vote on the target, and every vote on the target (for the recount).
    voteFilter: Record<string, unknown>;
    targetFilter: Record<string, unknown>;
    counterModel: any;
    counterId: Types.ObjectId | string;
    type: boolean;
    voterId: string;
}

const RECOUNT_ATTEMPTS = 3;

/**
 * Shared toggle/switch semantics for post, comment, and user votes:
 * no existing vote creates one; voting the same type again removes it
 * (toggle off); voting the opposite type switches it. The target's
 * denormalized upvoteCount/downvoteCount are then recounted from the live
 * vote records, so concurrent clicks or earlier drift can't leave them wrong.
 */
export async function toggleVote(options: ToggleVoteOptions): Promise<VoteResult> {
    const { voteModel, voteFilter, type, voterId } = options;
    let existing = (await voteModel.findOne(voteFilter)) as VoteDocument | null;

    let action: VoteAction = "created";
    if (!existing) {
        try {
            await voteModel.create({ ...voteFilter, type });
        } catch (error) {
            if ((error as { code?: number }).code !== 11000) throw error;
            // A concurrent request by the same voter created a vote first (unique index). This click
            // asked for `type`, so it keeps that vote or switches it, but never withdraws it.
            existing = (await voteModel.findOne(voteFilter)) as VoteDocument | null;
            if (existing && existing.type !== type) {
                existing.type = type;
                await existing.save();
                action = "switched";
            }
        }
    } else if (existing.type === type) {
        await existing.delete(voterId);
        action = "removed";
    } else {
        existing.type = type;
        await existing.save();
        action = "switched";
    }

    const counts = await recountVotes(options);
    return { action, currentType: action === "removed" ? null : type, ...counts };
}

// A concurrent vote can store its count after this one; re-counting after each write until it holds means the
// request that finishes last always leaves the counter matching the records.
async function recountVotes({ voteModel, targetFilter, counterModel, counterId }: ToggleVoteOptions) {
    const count = async () => {
        const [upvoteCount, downvoteCount] = await Promise.all([
            voteModel.countDocuments({ ...targetFilter, type: true }),
            voteModel.countDocuments({ ...targetFilter, type: false }),
        ]);
        return { upvoteCount, downvoteCount };
    };
    let counts = await count();
    for (let attempt = 0; attempt < RECOUNT_ATTEMPTS; attempt++) {
        await counterModel.updateOne({ _id: counterId }, { $set: counts });
        const after = await count();
        if (after.upvoteCount === counts.upvoteCount && after.downvoteCount === counts.downvoteCount) break;
        counts = after;
    }
    return counts;
}
