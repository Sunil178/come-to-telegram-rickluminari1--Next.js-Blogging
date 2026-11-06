import { beforeEach, describe, expect, it } from "vitest";
import { clearAllDrafts, draftKey, readDraft, withoutNodeIds, writeDraft } from "@/libs/post-drafts";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
    value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
    },
    configurable: true,
});

describe("post drafts", () => {
    beforeEach(() => store.clear());

    it("keys drafts by user and post", () => {
        expect(draftKey("u1", null)).toBe("post-draft:u1:new");
        expect(draftKey("u1", "my-post")).toBe("post-draft:u1:my-post");
    });

    it("round-trips a draft", () => {
        const draft = { savedAt: 1, title: "T", titleDescription: "", slug: "t", tags: [], bannerImage: "", publishAt: "", isPrivate: true, content: [] };
        writeDraft("post-draft:u1:new", draft);
        expect(readDraft("post-draft:u1:new")).toEqual(draft);
    });

    it("compares editor content without Plate's per-load node ids", () => {
        const a = [{ type: "p", id: "abc", children: [{ text: "hi" }] }];
        const b = [{ type: "p", id: "xyz", children: [{ text: "hi" }] }];
        expect(JSON.stringify(withoutNodeIds(a))).toBe(JSON.stringify(withoutNodeIds(b)));
    });

    it("clearAllDrafts removes only draft keys", () => {
        const fake = { "post-draft:u1:new": "{}", "post-draft:u2:x": "{}", theme: "dark" };
        const storage = {
            ...Object.fromEntries(Object.entries(fake)),
            removeItem(key: string) { delete (this as Record<string, unknown>)[key]; },
        };
        Object.defineProperty(storage, "removeItem", { enumerable: false });
        Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
        clearAllDrafts();
        expect(Object.keys(storage)).toEqual(["theme"]);
    });
});
