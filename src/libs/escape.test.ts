import { describe, expect, it } from "vitest";
import { escapeMarkup } from "@/libs/escape";

describe("escapeMarkup", () => {
    it("escapes every markup-significant character, ampersands first", () => {
        expect(escapeMarkup(`<a href="x" title='y'>&amp;</a>`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;amp;&lt;/a&gt;");
    });
});
