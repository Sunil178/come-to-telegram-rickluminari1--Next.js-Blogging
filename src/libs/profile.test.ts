import { describe, expect, it } from "vitest";
import { ageOn, parseProfileInput, PRIVATE_PROFILE_FIELDS, profileLinks, PUBLIC_PROFILE_FIELDS } from "@/libs/profile";

const ALL = [...PUBLIC_PROFILE_FIELDS, ...PRIVATE_PROFILE_FIELDS];

describe("parseProfileInput", () => {
    it("maps public and private fields to their paths and trims text", () => {
        const result = parseProfileInput({ bio: "  Writes about Rust.  ", phone: "+91 98765 43210", topics: "rust, web , rust" }, ALL);
        expect(result).toEqual({
            ok: true,
            set: { "profile.bio": "Writes about Rust.", "privateDetails.phone": "+91 98765 43210", "profile.topics": ["rust", "web"] },
        });
    });

    it("only touches the fields it's given, and clears empty ones", () => {
        expect(parseProfileInput({ city: "", links: [] }, ALL)).toEqual({ ok: true, set: { "profile.city": null, "profile.links": [] } });
        expect(parseProfileInput({ city: "Pune", phone: "123456" }, ["city"])).toEqual({ ok: true, set: { "profile.city": "Pune" } });
    });

    it("splits links on new lines only, since addresses can contain commas", () => {
        expect(parseProfileInput({ links: "https://example.com/search?tags=a,b\nhttps://gh.example" }, ALL)).toEqual({
            ok: true,
            set: { "profile.links": ["https://example.com/search?tags=a,b", "https://gh.example"] },
        });
        expect(parseProfileInput({ links: "https://x.example/a,https://y.example" }, ALL)).toEqual({ ok: true, set: { "profile.links": ["https://x.example/a,https://y.example"] } });
    });

    it("refuses bad addresses, phones, lengths and list sizes", () => {
        expect(parseProfileInput({ website: "javascript:alert(1)" }, ALL)).toMatchObject({ ok: false });
        expect(parseProfileInput({ links: ["https://ok.example", "ftp://nope"] }, ALL)).toMatchObject({ ok: false });
        expect(parseProfileInput({ phone: "call me" }, ALL)).toMatchObject({ ok: false });
        expect(parseProfileInput({ headline: "x".repeat(121) }, ALL)).toMatchObject({ ok: false });
        expect(parseProfileInput({ topics: Array.from({ length: 11 }, (_, i) => `t${i}`) }, ALL)).toMatchObject({ ok: false });
        expect(parseProfileInput({ bio: { $gt: "" } }, ALL)).toMatchObject({ ok: false });
    });

    it("accepts a date of birth for someone at least 13, and nothing in the future", () => {
        const set = parseProfileInput({ dateOfBirth: "1990-05-17" }, ALL);
        expect(set).toEqual({ ok: true, set: { "privateDetails.dateOfBirth": new Date("1990-05-17T00:00:00Z") } });
        const tooYoung = new Date();
        tooYoung.setUTCFullYear(tooYoung.getUTCFullYear() - 10);
        expect(parseProfileInput({ dateOfBirth: tooYoung.toISOString().slice(0, 10) }, ALL)).toMatchObject({ ok: false });
        expect(parseProfileInput({ dateOfBirth: "2999-01-01" }, ALL)).toMatchObject({ ok: false });
        expect(parseProfileInput({ dateOfBirth: "17/05/1990" }, ALL)).toMatchObject({ ok: false });
        // Date would roll these over into the next month.
        expect(parseProfileInput({ dateOfBirth: "2001-02-30" }, ALL)).toMatchObject({ ok: false });
        expect(parseProfileInput({ dateOfBirth: "2001-04-31" }, ALL)).toMatchObject({ ok: false });
    });
});

describe("ageOn", () => {
    it("counts a birthday only once it has passed", () => {
        const birth = new Date("2000-06-15T00:00:00Z");
        expect(ageOn(birth, new Date("2026-06-14T00:00:00Z"))).toBe(25);
        expect(ageOn(birth, new Date("2026-06-15T00:00:00Z"))).toBe(26);
    });
});

describe("profileLinks", () => {
    it("lists the website first and drops a link entered twice", () => {
        expect(profileLinks({ website: "https://me.dev", links: ["https://me.dev", "https://gh.example"] })).toEqual(["https://me.dev", "https://gh.example"]);
    });
});
