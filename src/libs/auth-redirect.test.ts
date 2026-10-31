import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "@/libs/auth-redirect";

const ORIGIN = "https://blog.example";

describe("safeCallbackPath", () => {
    it.each(["/posts", "/posts/my-post?x=1#comment-2", "/dashboard/posts"])("keeps same-site path %s", (path) => {
        expect(safeCallbackPath(path, ORIGIN)).toBe(path);
    });

    it.each(["//evil.com", "/\\evil.com", "/\\/evil.com", "https://evil.com/x", "javascript:alert(1)", " //evil.com", ""])(
        "falls back for off-site or malformed target %j",
        (target) => {
            expect(safeCallbackPath(target, ORIGIN)).toBe("/posts");
        }
    );

    it("falls back when there's no callback", () => {
        expect(safeCallbackPath(null, ORIGIN)).toBe("/posts");
    });
});
