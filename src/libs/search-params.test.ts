import { describe, expect, it } from "vitest";
import { firstParam, parsePageParam } from "@/libs/search-params";

describe("search params", () => {
    it("reads the first of a repeated parameter", () => {
        expect(firstParam(["a", "b"])).toBe("a");
        expect(firstParam("a")).toBe("a");
        expect(firstParam(undefined)).toBeUndefined();
    });

    it("parses a page number, falling back to 1", () => {
        expect(parsePageParam("3")).toBe(3);
        expect(parsePageParam(["2", "5"])).toBe(2);
        expect(parsePageParam("0")).toBe(1);
        expect(parsePageParam("abc")).toBe(1);
        expect(parsePageParam(undefined)).toBe(1);
    });
});
