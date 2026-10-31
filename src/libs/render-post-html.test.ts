import { describe, expect, it } from "vitest";
import { renderPostContent, sanitizePostHtml } from "@/libs/render-post-html";

describe("sanitizePostHtml", () => {
    it("removes scripts and event handlers, keeping the content", () => {
        expect(sanitizePostHtml('<p onclick="x()">Hi<script>alert(1)</script></p>')).toBe("<p>Hi</p>");
    });
});

describe("renderPostContent", () => {
    it("sanitizes and builds the table of contents", () => {
        const result = renderPostContent("<h2>Intro</h2><p>text</p><img src=x onerror=alert(1)>");
        expect(result.html).not.toContain("onerror");
        expect(result.toc).toEqual([{ id: "intro", text: "Intro", level: 2 }]);
    });

    it("reuses the rendering for unchanged HTML and redoes it after an edit", () => {
        const first = renderPostContent("<h2>Old</h2>");
        expect(renderPostContent("<h2>Old</h2>")).toBe(first);
        expect(renderPostContent("<h2>New</h2>").toc[0].text).toBe("New");
    });

    it("doesn't keep very large posts in memory", () => {
        const huge = `<p>${"x".repeat(600 * 1024)}</p>`;
        expect(renderPostContent(huge)).not.toBe(renderPostContent(huge));
    });
});
