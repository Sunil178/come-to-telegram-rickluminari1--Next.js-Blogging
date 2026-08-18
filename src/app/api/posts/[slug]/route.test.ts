import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOneAndUpdateMock = vi.fn();
const softDeleteMock = vi.fn();
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: {
            findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args),
            delete: (...args: unknown[]) => softDeleteMock(...args),
        },
    };
});

vi.mock("@/libs/post-editor-serialize", () => ({
    parsePostEditorValue: () => ({ some: "value" }),
    serializePostContent: async () => "<p>content</p>",
}));

const { PATCH, DELETE } = await import("@/app/api/posts/[slug]/route");

function context(slug: string) {
    return { params: Promise.resolve({ slug }) };
}

function patchRequest(fields: Record<string, string>) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return new NextRequest("http://localhost/api/posts/some-slug", { method: "PATCH", body });
}

describe("PATCH /api/posts/[slug]", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "author1", role: "author" } });
    });

    it("scopes the update to the owner for a non-admin", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug" });
        await PATCH(patchRequest({ title: "New title", post_data: "{}" }), context("some-slug"));

        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug", userId: "author1" },
            expect.anything(),
            { new: true }
        );
    });

    it("lets an admin update any post regardless of owner", async () => {
        authMock.mockResolvedValue({ user: { id: "admin1", role: "admin" } });
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug" });
        await PATCH(patchRequest({ title: "New title", post_data: "{}" }), context("some-slug"));

        expect(findOneAndUpdateMock).toHaveBeenCalledWith({ slug: "some-slug" }, expect.anything(), { new: true });
    });

    it("normalizes a client-supplied slug instead of trusting it verbatim", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "foobar" });
        await PATCH(patchRequest({ title: "New title", slug: "foo;bar", post_data: "{}" }), context("some-slug"));

        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug", userId: "author1" },
            expect.objectContaining({ slug: "foobar" }),
            { new: true }
        );
    });
});

describe("DELETE /api/posts/[slug]", () => {
    beforeEach(() => {
        softDeleteMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "author1", role: "author" } });
    });

    it("scopes the delete to the owner for a non-admin", async () => {
        softDeleteMock.mockResolvedValue({ matchedCount: 1 });
        await DELETE(new NextRequest("http://localhost/api/posts/some-slug", { method: "DELETE" }), context("some-slug"));

        expect(softDeleteMock).toHaveBeenCalledWith({ slug: "some-slug", userId: "author1" }, "author1");
    });

    it("lets an admin delete any post regardless of owner", async () => {
        authMock.mockResolvedValue({ user: { id: "admin1", role: "admin" } });
        softDeleteMock.mockResolvedValue({ matchedCount: 1 });
        await DELETE(new NextRequest("http://localhost/api/posts/some-slug", { method: "DELETE" }), context("some-slug"));

        expect(softDeleteMock).toHaveBeenCalledWith({ slug: "some-slug" }, "admin1");
    });
});
