import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: (fn: () => unknown) => fn() };
});

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOnePostMock = vi.fn();
const updateOnePostMock = vi.fn();
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: {
            findOne: (...args: unknown[]) => findOnePostMock(...args),
            updateOne: (...args: unknown[]) => updateOnePostMock(...args),
        },
    };
});

const findOneWithDeletedMock = vi.fn();
const createCommentMock = vi.fn();
vi.mock("@/models/Comment", async () => {
    const actual = await vi.importActual<typeof import("@/models/Comment")>("@/models/Comment");
    return {
        ...actual,
        default: {
            findOneWithDeleted: (...args: unknown[]) => findOneWithDeletedMock(...args),
            create: (...args: unknown[]) => createCommentMock(...args),
        },
    };
});

const notifyMock = vi.fn();
vi.mock("@/libs/notify", () => ({ notify: (...args: unknown[]) => notifyMock(...args) }));

const { POST } = await import("@/app/api/posts/[slug]/comments/route");

function context(slug: string) {
    return { params: Promise.resolve({ slug }) };
}

// A distinct client IP per request keeps the route's rate limiter out of these tests.
let requestCount = 0;
function commentRequest(body: unknown) {
    return new NextRequest("http://localhost/api/posts/some-slug/comments", {
        method: "POST",
        headers: { "x-forwarded-for": `10.0.0.${++requestCount}` },
        body: JSON.stringify(body),
    });
}

const POST_DOC = { _id: "post-1", slug: "some-slug", title: "Docker for Developers", userId: "author-1", approval: "Approved", published: true, visibility: true };

describe("POST /api/posts/[slug]/comments", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "commenter-1", role: "reader" } });
        findOnePostMock.mockReset().mockResolvedValue(POST_DOC);
        updateOnePostMock.mockReset().mockResolvedValue({});
        findOneWithDeletedMock.mockReset();
        createCommentMock.mockReset().mockResolvedValue({ _id: "comment-1", content: "hi", createdAt: new Date() });
        notifyMock.mockReset();
    });

    it("notifies the post's author on a top-level comment", async () => {
        const response = await POST(commentRequest({ content: "Nice post!" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(notifyMock).toHaveBeenCalledTimes(1);
        expect(notifyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                recipientId: "author-1",
                actorId: "commenter-1",
                type: "post_comment",
                postId: "post-1",
                commentId: "comment-1",
            })
        );
    });

    it("still delegates the self-comment case to notify's own guard when the post's author comments on their own post", async () => {
        authMock.mockResolvedValue({ user: { id: "author-1", role: "author" } });

        const response = await POST(commentRequest({ content: "Adding context" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(notifyMock).toHaveBeenCalledWith(
            expect.objectContaining({ type: "post_comment", recipientId: "author-1", actorId: "author-1" })
        );
    });

    it("notifies both the parent comment's author and the post's author on a reply to a third party", async () => {
        findOneWithDeletedMock.mockResolvedValue({ _id: "6500000000000000000000e1", userId: "parent-author-1" });

        const response = await POST(commentRequest({ content: "I agree!", parentId: "6500000000000000000000e1" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(notifyMock).toHaveBeenCalledTimes(2);
        expect(notifyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                recipientId: "parent-author-1",
                actorId: "commenter-1",
                type: "comment_reply",
                postId: "post-1",
                commentId: "comment-1",
            })
        );
        expect(notifyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                recipientId: "author-1",
                actorId: "commenter-1",
                type: "post_comment",
                postId: "post-1",
                commentId: "comment-1",
            })
        );
    });

    it("sends only comment_reply, not a duplicate post_comment, when replying to the post author's own comment", async () => {
        findOneWithDeletedMock.mockResolvedValue({ _id: "6500000000000000000000e1", userId: "author-1" });

        const response = await POST(commentRequest({ content: "Replying to the author", parentId: "6500000000000000000000e1" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(notifyMock).toHaveBeenCalledTimes(1);
        expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ type: "comment_reply", recipientId: "author-1" }));
    });

    it("still delegates the self-reply case to notify's own guard, passing matching ids", async () => {
        findOneWithDeletedMock.mockResolvedValue({ _id: "6500000000000000000000e1", userId: "commenter-1" });

        await POST(commentRequest({ content: "Replying to myself", parentId: "6500000000000000000000e1" }), context("some-slug"));

        expect(notifyMock).toHaveBeenCalledWith(
            expect.objectContaining({ recipientId: "commenter-1", actorId: "commenter-1", type: "comment_reply" })
        );
    });

    it("does not notify the parent's author when the parent comment was soft-deleted, but still notifies the post's author", async () => {
        findOneWithDeletedMock.mockResolvedValue({ _id: "6500000000000000000000e1", userId: "parent-author-1", deleted: true });

        const response = await POST(commentRequest({ content: "Reply to deleted", parentId: "6500000000000000000000e1" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(notifyMock).toHaveBeenCalledTimes(1);
        expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ type: "post_comment", recipientId: "author-1" }));
    });

    it("returns 400 without notifying when the parent comment doesn't exist", async () => {
        findOneWithDeletedMock.mockResolvedValue(null);

        const response = await POST(commentRequest({ content: "Reply", parentId: "6500000000000000000000ff" }), context("some-slug"));

        expect(response.status).toBe(400);
        expect(createCommentMock).not.toHaveBeenCalled();
        expect(notifyMock).not.toHaveBeenCalled();
    });

    it("returns 400 for a malformed parentId without querying", async () => {
        const response = await POST(commentRequest({ content: "Reply", parentId: "not-an-id" }), context("some-slug"));

        expect(response.status).toBe(400);
        expect(findOneWithDeletedMock).not.toHaveBeenCalled();
    });
});
