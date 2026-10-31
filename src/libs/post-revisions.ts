import PostRevision from "@/models/PostRevision";
import { logger } from "@/libs/logger";

export const MAX_REVISIONS_PER_POST = 20;
export const REVISION_FIELDS = ["title", "titleDescription", "tags", "bannerImage", "content"] as const;

type RevisionSource = { _id: unknown } & Partial<Record<(typeof REVISION_FIELDS)[number], unknown>>;

// Plate stamps every block with a random data-block-id on each load, so an unchanged post would
// otherwise serialize differently on every save and record a revision each time.
const comparable = (value: unknown) => (typeof value === "string" ? value.replace(/\sdata-block-id="[^"]*"/g, "") : value);
const same = (a: unknown, b: unknown) => JSON.stringify(comparable(a) ?? null) === JSON.stringify(comparable(b) ?? null);

// Snapshots `before` when the edit changed any revisioned field, then trims the post's history to
// the newest MAX_REVISIONS_PER_POST. Never throws: losing a snapshot must not fail the save.
export async function recordRevision(before: RevisionSource, after: Omit<RevisionSource, "_id">, editorId: string): Promise<void> {
    if (REVISION_FIELDS.every((field) => same(before[field], after[field]))) return;
    try {
        await PostRevision.create({
            postId: before._id,
            editorId,
            ...Object.fromEntries(REVISION_FIELDS.map((field) => [field, before[field]])),
        });
        const stale = await PostRevision.find({ postId: before._id })
            .sort({ createdAt: -1 })
            .skip(MAX_REVISIONS_PER_POST)
            .select("_id")
            .lean();
        if (stale.length) await PostRevision.deleteMany({ _id: { $in: stale.map((revision) => revision._id) } });
    } catch (error) {
        logger.error("Failed to record a post revision", { error });
    }
}
