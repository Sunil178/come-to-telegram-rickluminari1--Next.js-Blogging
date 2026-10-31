import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: (fn: () => unknown) => fn() };
});

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const postFindOneMock = vi.fn();
const postUpdateOneMock = vi.fn();
vi.mock("@/models/Post", () => ({
    default: {
        findOne: (...args: unknown[]) => ({ select: () => ({ lean: () => postFindOneMock(...args) }) }),
        findOneAndUpdate: (...args: unknown[]) => postUpdateOneMock(...args),
    },
}));
const revisionFindOneMock = vi.fn();
vi.mock("@/models/PostRevision", () => ({ default: { findOne: (...args: unknown[]) => ({ lean: () => revisionFindOneMock(...args) }) } }));
const recordRevisionMock = vi.fn();
vi.mock("@/libs/post-revisions", async () => {
    const actual = await vi.importActual<typeof import("@/libs/post-revisions")>("@/libs/post-revisions");
    return { ...actual, recordRevision: (...args: unknown[]) => recordRevisionMock(...args) };
});

const { POST } = await import("@/app/api/posts/[slug]/revisions/[id]/route");

const REVISION_ID = "6500000000000000000000f1";
const restore = (id = REVISION_ID) =>
    POST(new NextRequest("http://localhost/api/posts/p/revisions/x", { method: "POST" }), { params: Promise.resolve({ slug: "p", id }) });

describe("POST /api/posts/[slug]/revisions/[id]", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "author1", role: "author" } });
        postFindOneMock.mockReset().mockResolvedValue({ _id: "post-1", slug: "p", title: "Current" });
        postUpdateOneMock.mockReset().mockResolvedValue({ _id: "post-1", title: "Current" });
        revisionFindOneMock.mockReset().mockResolvedValue({ title: "Old", titleDescription: "d", tags: ["a"], bannerImage: "", content: "<p>old</p>", editorId: "x" });
        recordRevisionMock.mockReset().mockResolvedValue(undefined);
    });

    it("restores the revision's fields and keeps the current version as a revision", async () => {
        const response = await restore();

        expect(response.status).toBe(200);
        expect(postFindOneMock).toHaveBeenCalledWith({ slug: "p", userId: "author1" });
        expect(revisionFindOneMock).toHaveBeenCalledWith({ _id: REVISION_ID, postId: "post-1" });
        const restored = { title: "Old", titleDescription: "d", tags: ["a"], bannerImage: "", content: "<p>old</p>" };
        expect(postUpdateOneMock).toHaveBeenCalledWith({ _id: "post-1" }, { $set: restored }, { returnDocument: "before" });
        expect(recordRevisionMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Current" }), restored, "author1");
    });

    it("lets an admin restore any post's revision", async () => {
        authMock.mockResolvedValue({ user: { id: "admin1", role: "admin" } });
        await restore();
        expect(postFindOneMock).toHaveBeenCalledWith({ slug: "p" });
    });

    it("404s for someone else's post or a revision of another post", async () => {
        postFindOneMock.mockResolvedValueOnce(null);
        expect((await restore()).status).toBe(404);
        revisionFindOneMock.mockResolvedValueOnce(null);
        expect((await restore()).status).toBe(404);
        expect(postUpdateOneMock).not.toHaveBeenCalled();
    });

    it("rejects a malformed revision id and anonymous callers", async () => {
        expect((await restore("nope")).status).toBe(400);
        authMock.mockResolvedValue(null);
        expect((await restore()).status).toBe(401);
    });
});
