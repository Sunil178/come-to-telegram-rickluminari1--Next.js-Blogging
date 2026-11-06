import { describe, expect, it } from "vitest";
import { newContactReference, parseContactInput } from "@/libs/contact";

const valid = { topic: "question", name: " Asha ", email: "Asha@Example.com", url: "", message: "How do I become an author on this site?" };

describe("parseContactInput", () => {
    it("trims the fields, lowercases the email and drops an empty link", () => {
        expect(parseContactInput(valid)).toEqual({ ok: true, value: { topic: "question", name: "Asha", email: "asha@example.com", url: null, message: "How do I become an author on this site?" } });
    });

    it("refuses an unknown topic, a missing name, a bad email, a non-web link or a too-short message", () => {
        expect(parseContactInput({ ...valid, topic: "toString" })).toMatchObject({ ok: false });
        expect(parseContactInput({ ...valid, name: "  " })).toMatchObject({ ok: false });
        expect(parseContactInput({ ...valid, email: "asha@" })).toMatchObject({ ok: false });
        expect(parseContactInput({ ...valid, url: "javascript:alert(1)" })).toMatchObject({ ok: false });
        expect(parseContactInput({ ...valid, message: "hi" })).toMatchObject({ ok: false });
        expect(parseContactInput({ ...valid, message: { $ne: "" } })).toMatchObject({ ok: false });
        expect(parseContactInput(null)).toMatchObject({ ok: false });
    });

    it("requires a link for a report or a copyright complaint", () => {
        expect(parseContactInput({ ...valid, topic: "report" })).toMatchObject({ ok: false });
        expect(parseContactInput({ ...valid, topic: "copyright" })).toMatchObject({ ok: false });
    });

    it("keeps a web link to what is reported", () => {
        expect(parseContactInput({ ...valid, topic: "report", url: "https://vedev.guru/posts/x" })).toMatchObject({ ok: true, value: { url: "https://vedev.guru/posts/x" } });
    });
});

describe("newContactReference", () => {
    it("makes short references without look-alike characters", () => {
        const reference = newContactReference();
        expect(reference).toMatch(/^C-[2-9A-HJKMNP-Z]{8}$/);
        expect(newContactReference()).not.toBe(reference);
    });
});
