import { describe, expect, it } from "vitest";
import { hasMalformedEscape, isGatedPath } from "@/libs/route-gates";

describe("isGatedPath", () => {
    it.each(["/posts/add", "/posts/my-post/edit", "/posts/my-post/revisions", "/dashboard", "/dashboard/admin/users"])("gates %s", (path) => {
        expect(isGatedPath(path)).toBe(true);
    });

    it.each(["/", "/posts", "/posts/my-post", "/posts/add-ons-guide", "/dashboards", "/users/someone"])("leaves %s public", (path) => {
        expect(isGatedPath(path)).toBe(false);
    });
});

describe("hasMalformedEscape", () => {
    it.each(["/users/%E0%A4%A", "/posts/%", "/posts/%zz"])("flags %s", (path) => {
        expect(hasMalformedEscape(path)).toBe(true);
    });

    it.each(["/users/e2e.author", "/users/%E0%A4%85", "/posts/a%20b", "/"])("accepts %s", (path) => {
        expect(hasMalformedEscape(path)).toBe(false);
    });
});
