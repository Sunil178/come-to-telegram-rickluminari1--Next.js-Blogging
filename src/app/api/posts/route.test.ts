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

const { POST } = await import("@/app/api/posts/route");

function postRequest(fields: Record<string, string>) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return new NextRequest("http://localhost/api/posts", { method: "POST", body });
}

describe("POST /api/posts", () => {
    beforeEach(() => {
        createMock.mockReset();
    });

    it("rejects a reader-role session with 403", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });

        const response = await POST(postRequest({ title: "New post", post_data: "{}" }), {});

        expect(response.status).toBe(403);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("lets an author-role session create a post", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "author" } });
        createMock.mockResolvedValue({ slug: "new-post" });

        const response = await POST(postRequest({ title: "New post", post_data: "{}" }), {});

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.data).toEqual({ slug: "new-post" });
        expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", slug: "new-post", title: "New post" }));
    });
});
