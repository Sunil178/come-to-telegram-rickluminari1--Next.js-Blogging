// Parses the editor's optional "publish at" field (an ISO timestamp the browser built from local time).
// Empty means "publish on approval"; anything unparsable or more than a year out is rejected.
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

export function parsePublishAt(value: FormDataEntryValue | null, now: Date = new Date()): { ok: true; value: Date | null } | { ok: false } {
    if (value === null || value === "") return { ok: true, value: null };
    if (typeof value !== "string") return { ok: false };
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date.getTime() - now.getTime() > MAX_AHEAD_MS) return { ok: false };
    // A past time just means "as soon as it's approved".
    return { ok: true, value: date.getTime() > now.getTime() ? date : null };
}

// Pipeline expression applied to an approved post when its schedule is edited. Only a post that
// hasn't gone live yet moves: a future publishAt reschedules it, clearing it publishes now. A live post
// keeps its publishedAt, so an author can't take it down without moderation. `now` is the app's clock,
// which visibility checks also use (MongoDB's $$NOW could be skewed from it).
export function rescheduledPublishedAt(publishAt: Date | null, now: Date = new Date()) {
    return {
        $cond: [
            { $gt: ["$publishedAt", now] },
            { $cond: [{ $gt: [publishAt, now] }, publishAt, now] },
            "$publishedAt",
        ],
    };
}
