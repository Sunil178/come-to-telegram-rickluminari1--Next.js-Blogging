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

// Pipeline expression applied to an approved post when its schedule is edited: a future publishAt
// (re)schedules it, and clearing the schedule of a still-scheduled post publishes it now.
export function rescheduledPublishedAt(publishAt: Date | null) {
    return {
        $cond: [
            { $gt: [publishAt, "$$NOW"] },
            publishAt,
            { $cond: [{ $gt: ["$publishedAt", "$$NOW"] }, "$$NOW", "$publishedAt"] },
        ],
    };
}
