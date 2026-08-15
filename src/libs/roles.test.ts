import { describe, expect, it } from "vitest";
import { hasRole } from "@/libs/roles";

describe("hasRole", () => {
    it("returns true when the role meets the minimum", () => {
        expect(hasRole("admin", "moderator")).toBe(true);
        expect(hasRole("moderator", "moderator")).toBe(true);
    });

    it("returns false when the role is below the minimum", () => {
        expect(hasRole("reader", "author")).toBe(false);
        expect(hasRole("author", "moderator")).toBe(false);
    });

    it("treats an undefined role as reader", () => {
        expect(hasRole(undefined, "reader")).toBe(true);
        expect(hasRole(undefined, "author")).toBe(false);
    });
});
