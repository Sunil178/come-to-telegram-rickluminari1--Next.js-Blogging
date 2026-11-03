import { describe, expect, it } from "vitest";
import { isPubliclyVisible, isScheduled, publicPostFilter } from "@/libs/post-visibility";

const now = new Date("2026-10-31T12:00:00Z");
const live = { approval: "Approved", published: true, visibility: true, publishedAt: new Date("2026-10-30T12:00:00Z") };

describe("post visibility", () => {
    it("requires approval, publication, visibility and a reached publish time", () => {
        expect(isPubliclyVisible(live, now)).toBe(true);
        expect(isPubliclyVisible({ ...live, approval: "Pending" }, now)).toBe(false);
        expect(isPubliclyVisible({ ...live, published: false }, now)).toBe(false);
        expect(isPubliclyVisible({ ...live, visibility: false }, now)).toBe(false);
        expect(isPubliclyVisible({ ...live, publishedAt: null }, now)).toBe(false);
    });

    it("hides a scheduled post until its publish time", () => {
        const scheduled = { ...live, publishedAt: new Date("2026-11-02T09:00:00Z") };
        expect(isPubliclyVisible(scheduled, now)).toBe(false);
        expect(isScheduled(scheduled, now)).toBe(true);
        expect(isPubliclyVisible(scheduled, new Date("2026-11-02T09:00:00Z"))).toBe(true);
        expect(isScheduled(live, now)).toBe(false);
        // Hidden or unpublished posts never go live, so they aren't "scheduled".
        expect(isScheduled({ ...scheduled, visibility: false }, now)).toBe(false);
    });

    it("builds the matching query", () => {
        expect(publicPostFilter(now)).toEqual({ approval: "Approved", published: true, visibility: true, publishedAt: { $lte: now } });
    });
});
