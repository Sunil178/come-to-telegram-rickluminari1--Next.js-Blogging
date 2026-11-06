import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMock = vi.fn();
vi.mock("@/libs/api-guard", () => ({ getSession: () => sessionMock() }));
let stored: Record<string, unknown> | null = null;
vi.mock("@/models/Post", () => {
    const query = { populate: () => query, lean: async () => stored };
    return { default: { findOne: () => query } };
});
vi.mock("@/models/User", () => ({ default: {} }));
vi.mock("@/models/Category", () => ({ default: {} }));

const { getViewablePost } = await import("@/libs/post-page");

const draft = { slug: "draft", approval: "Pending", published: false, visibility: true, publishedAt: null, userId: { _id: "author-1" } };

describe("getViewablePost", () => {
    beforeEach(() => sessionMock.mockReset());

    it("shows a draft to a moderator", async () => {
        stored = draft;
        sessionMock.mockResolvedValue({ user: { id: "mod-1", role: "moderator" } });
        expect(await getViewablePost("draft-mod")).not.toBeNull();
    });

    it("hides a private post from moderators and admins", async () => {
        stored = { ...draft, visibility: false };
        sessionMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
        expect(await getViewablePost("private-admin")).toBeNull();
    });

    it("shows a private post to its author", async () => {
        stored = { ...draft, visibility: false };
        sessionMock.mockResolvedValue({ user: { id: "author-1", role: "author" } });
        expect(await getViewablePost("private-author")).not.toBeNull();
    });
});
