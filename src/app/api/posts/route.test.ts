import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const createMock = vi.fn();
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: { create: (...args: unknown[]) => createMock(...args) },
    };
});

vi.mock("@/libs/post-editor-serialize", () => ({
    parsePostEditorValue: () => ({ some: "value" }),
    serializePostContent: async () => "<p>content</p>",
}));

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: (fn: () => unknown) => fn() };
});
const parseCategoryMock = vi.fn();
vi.mock("@/libs/post-category", () => ({ parseCategoryId: (...args: unknown[]) => parseCategoryMock(...args) }));
const notifySubmittedMock = vi.fn();
vi.mock("@/libs/review-notifications", () => ({ notifyPostSubmitted: (...args: unknown[]) => notifySubmittedMock(...args) }));

const { GET, POST } = await import("@/app/api/posts/route");

function postRequest(fields: Record<string, string>) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return new NextRequest("http://localhost/api/posts", { method: "POST", body });
}

describe("POST /api/posts", () => {
    beforeEach(() => {
        createMock.mockReset();
        notifySubmittedMock.mockReset();
        parseCategoryMock.mockResolvedValue({ ok: true, value: null });
    });

    it("rejects a reader-role session with 403", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });

        const response = await POST(postRequest({ title: "New post", post_data: "{}" }), {});

        expect(response.status).toBe(403);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("lets an author-role session create a post", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "author" } });
        createMock.mockResolvedValue({ _id: "p1", slug: "new-post" });

        const response = await POST(postRequest({ title: "New post", post_data: "{}" }), {});

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toEqual({ slug: "new-post" });
        expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", slug: "new-post", title: "New post" }));
    });

    it("normalizes a client-supplied slug instead of trusting it verbatim", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "author" } });
        createMock.mockResolvedValue({ _id: "p1", slug: "foobar" });

        await POST(postRequest({ title: "New post", slug: "foo;bar", post_data: "{}" }), {});

        expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ slug: "foobar" }));
    });
});

describe("POST /api/posts categories and review", () => {
    beforeEach(() => {
        createMock.mockReset();
        notifySubmittedMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "u1", role: "author", username: "writer" } });
    });

    it("files the post under a chosen category", async () => {
        parseCategoryMock.mockResolvedValue({ ok: true, value: "cat1" });
        createMock.mockResolvedValue({ _id: "p1", slug: "new-post", title: "New post" });

        await POST(postRequest({ title: "New post", post_data: "{}", categoryId: "cat1" }), {});

        expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ categoryId: "cat1" }));
    });

    it("refuses an unknown or hidden category", async () => {
        parseCategoryMock.mockResolvedValue({ ok: false });

        const response = await POST(postRequest({ title: "New post", post_data: "{}", categoryId: "nope" }), {});

        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("tells the moderators a new post is waiting for review", async () => {
        parseCategoryMock.mockResolvedValue({ ok: true, value: null });
        createMock.mockResolvedValue({ _id: "p1", slug: "new-post", title: "New post" });

        await POST(postRequest({ title: "New post", post_data: "{}" }), {});

        expect(notifySubmittedMock).toHaveBeenCalledWith({ id: "p1", title: "New post", slug: "new-post" }, { id: "u1", username: "writer" });
    });
});

describe("GET /api/posts", () => {
    it("is for moderators only: it lists posts in every state with author emails", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "author" } });
        const response = await GET(new NextRequest("http://localhost/api/posts"), {});
        expect(response.status).toBe(403);
    });
});
