import { describe, expect, it } from "vitest";
import { isGatedPath } from "@/libs/route-gates";

describe("isGatedPath", () => {
    it.each(["/posts/add", "/posts/my-post/edit", "/posts/my-post/revisions", "/dashboard", "/dashboard/admin/users"])("gates %s", (path) => {
        expect(isGatedPath(path)).toBe(true);
    });

    it.each(["/", "/posts", "/posts/my-post", "/posts/add-ons-guide", "/dashboards", "/users/someone"])("leaves %s public", (path) => {
        expect(isGatedPath(path)).toBe(false);
    });
});
