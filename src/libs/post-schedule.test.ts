import { describe, expect, it } from "vitest";
import { parsePublishAt, rescheduledPublishedAt } from "@/libs/post-schedule";

const now = new Date("2026-10-31T12:00:00Z");

describe("parsePublishAt", () => {
    it("treats empty as no schedule and past times as publish-on-approval", () => {
        expect(parsePublishAt(null, now)).toEqual({ ok: true, value: null });
        expect(parsePublishAt("", now)).toEqual({ ok: true, value: null });
        expect(parsePublishAt("2026-10-01T00:00:00Z", now)).toEqual({ ok: true, value: null });
    });

    it("accepts a future time within a year", () => {
        expect(parsePublishAt("2026-11-05T09:30:00.000Z", now)).toEqual({ ok: true, value: new Date("2026-11-05T09:30:00.000Z") });
    });

    it("rejects garbage and far-future times", () => {
        expect(parsePublishAt("next tuesday", now)).toEqual({ ok: false });
        expect(parsePublishAt("2030-01-01T00:00:00Z", now)).toEqual({ ok: false });
    });
});

describe("rescheduledPublishedAt", () => {
    it("moves only a not-yet-live post: to the new future time, or to now when the schedule is cleared", () => {
        const at = new Date("2026-11-05T09:30:00Z");
        const expr = rescheduledPublishedAt(at, now);
        expect(expr.$cond[0]).toEqual({ $gt: ["$publishedAt", now] });
        expect(expr.$cond[1]).toEqual({ $cond: [{ $gt: [at, now] }, at, now] });
        // Already live: unchanged, so an author can't unpublish it by picking a future date.
        expect(expr.$cond[2]).toBe("$publishedAt");
    });
});
