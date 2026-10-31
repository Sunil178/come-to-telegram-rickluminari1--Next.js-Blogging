import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: (fn: () => unknown) => fn() };
});

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOneAndUpdateMock = vi.fn();
const updateOneMock = vi.fn();
const softDeleteMock = vi.fn();
const recordRevisionMock = vi.fn();
vi.mock("@/libs/post-revisions", () => ({ recordRevision: (...args: unknown[]) => recordRevisionMock(...args) }));
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: {
            findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args),
            updateOne: (...args: unknown[]) => updateOneMock(...args),
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
        updateOneMock.mockReset().mockResolvedValue({});
        recordRevisionMock.mockReset().mockResolvedValue(undefined);
        authMock.mockResolvedValue({ user: { id: "author1", role: "author" } });
    });

    it("scopes the update to the owner for a non-admin", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug" });
        await PATCH(patchRequest({ title: "New title", post_data: "{}" }), context("some-slug"));

        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug", userId: "author1" },
            expect.anything(),
            { returnDocument: "before", updatePipeline: true }
        );
    });

    it("lets an admin update any post regardless of owner", async () => {
        authMock.mockResolvedValue({ user: { id: "admin1", role: "admin" } });
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug" });
        await PATCH(patchRequest({ title: "New title", post_data: "{}" }), context("some-slug"));

        expect(findOneAndUpdateMock).toHaveBeenCalledWith({ slug: "some-slug" }, expect.anything(), { returnDocument: "before", updatePipeline: true });
    });

    it("normalizes a client-supplied slug instead of trusting it verbatim", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "foobar" });
        await PATCH(patchRequest({ title: "New title", slug: "foo;bar", post_data: "{}" }), context("some-slug"));

        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug", userId: "author1" },
            [{ $set: expect.objectContaining({ slug: { $literal: "foobar" } }) }],
            { returnDocument: "before", updatePipeline: true }
        );
    });
});

describe("PATCH /api/posts/[slug] revisions and scheduling", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "author1", role: "author" } });
        updateOneMock.mockReset().mockResolvedValue({});
        recordRevisionMock.mockReset().mockResolvedValue(undefined);
        findOneAndUpdateMock.mockReset().mockResolvedValue({ _id: "post-1", slug: "some-slug", title: "Old", content: "<p>old</p>" });
    });

    it("keeps the replaced version as a revision and returns the new slug", async () => {
        const response = await PATCH(patchRequest({ title: "New title", slug: "new-slug", post_data: "[]" }), context("some-slug"));

        expect(await response.json()).toMatchObject({ data: { slug: "new-slug" } });
        expect(recordRevisionMock).toHaveBeenCalledWith(
            expect.objectContaining({ _id: "post-1", title: "Old" }),
            expect.objectContaining({ title: "New title", content: "<p>content</p>" }),
            "author1"
        );
    });

    it("stores a future publish time and reschedules an approved post", async () => {
        const at = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        await PATCH(patchRequest({ title: "T", post_data: "[]", publishAt: at }), context("some-slug"));

        // One atomic update: the edit, and the go-live time of an already-approved post.
        const [, pipeline, options] = findOneAndUpdateMock.mock.calls[0];
        expect(pipeline[0].$set.publishAt).toEqual({ $literal: new Date(at) });
        expect(pipeline[0].$set.publishedAt.$cond[0]).toEqual({ $eq: ["$approval", "Approved"] });
        expect(pipeline[0].$set.publishedAt.$cond[1].$cond[1].$cond[1]).toEqual(new Date(at));
        expect(options).toEqual({ returnDocument: "before", updatePipeline: true });
        expect(updateOneMock).not.toHaveBeenCalled();
    });

    it("wraps user text in $literal so it can't act as a pipeline expression", async () => {
        await PATCH(patchRequest({ title: "$100 tips", post_data: "[]" }), context("some-slug"));
        expect(findOneAndUpdateMock.mock.calls[0][1][0].$set.title).toEqual({ $literal: "$100 tips" });
    });

    it("rejects an invalid publish time", async () => {
        const response = await PATCH(patchRequest({ title: "T", post_data: "[]", publishAt: "soon" }), context("some-slug"));
        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
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
