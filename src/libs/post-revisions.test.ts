import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const staleMock = vi.fn();
const deleteManyMock = vi.fn();
vi.mock("@/models/PostRevision", () => ({
    default: {
        create: (...args: unknown[]) => createMock(...args),
        find: () => ({ sort: () => ({ skip: (n: number) => ({ select: () => ({ lean: () => staleMock(n) }) }) }) }),
        deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    },
}));

const { recordRevision, MAX_REVISIONS_PER_POST } = await import("@/libs/post-revisions");

const before = { _id: "post-1", title: "Old", titleDescription: "d", tags: ["a"], bannerImage: "", content: "<p>old</p>" };

describe("recordRevision", () => {
    beforeEach(() => {
        createMock.mockReset().mockResolvedValue({});
        staleMock.mockReset().mockResolvedValue([]);
        deleteManyMock.mockReset().mockResolvedValue({});
    });

    it("snapshots the previous version when content changed", async () => {
        await recordRevision(before, { ...before, content: "<p>new</p>" }, "editor-1");
        expect(createMock).toHaveBeenCalledWith({ postId: "post-1", editorId: "editor-1", title: "Old", titleDescription: "d", tags: ["a"], bannerImage: "", content: "<p>old</p>" });
    });

    it("skips saves that changed nothing revisioned", async () => {
        await recordRevision(before, { ...before }, "editor-1");
        expect(createMock).not.toHaveBeenCalled();
    });

    it("ignores Plate's per-load block ids when deciding whether content changed", async () => {
        await recordRevision(
            { ...before, content: '<p data-block-id="abc">same</p>' },
            { ...before, content: '<p data-block-id="xyz">same</p>' },
            "editor-1"
        );
        expect(createMock).not.toHaveBeenCalled();
    });

    it("keeps only the newest revisions", async () => {
        staleMock.mockResolvedValue([{ _id: "r-old" }]);
        await recordRevision(before, { ...before, tags: ["a", "b"] }, "editor-1");
        expect(staleMock).toHaveBeenCalledWith(MAX_REVISIONS_PER_POST);
        expect(deleteManyMock).toHaveBeenCalledWith({ _id: { $in: ["r-old"] } });
    });

    it("never throws", async () => {
        createMock.mockRejectedValue(new Error("db down"));
        await expect(recordRevision(before, { ...before, title: "New" }, "editor-1")).resolves.toBeUndefined();
    });
});
