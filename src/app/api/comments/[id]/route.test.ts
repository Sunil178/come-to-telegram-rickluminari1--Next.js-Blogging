import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOneMock = vi.fn();
const updateCommentMock = vi.fn();
vi.mock("@/models/Comment", () => ({
    default: {
        findOne: (...args: unknown[]) => {
            const result = findOneMock(...args);
            return Object.assign(Promise.resolve(result), { select: () => ({ lean: async () => result }) });
        },
        findOneAndUpdate: (...args: unknown[]) => updateCommentMock(...args),
    },
}));

const updateOneMock = vi.fn().mockResolvedValue(undefined);
const postMock = vi.fn();
vi.mock("@/models/Post", () => ({
    default: {
        updateOne: (...args: unknown[]) => updateOneMock(...args),
        findOneWithDeleted: () => ({ select: () => ({ lean: async () => postMock() }) }),
    },
}));

const { DELETE, PATCH } = await import("@/app/api/comments/[id]/route");

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}

function makeComment(overrides: Partial<{ userId: string; postId: string }> = {}) {
    return {
        userId: overrides.userId ?? "owner1",
        postId: overrides.postId ?? "post1",
        delete: vi.fn().mockResolvedValue(undefined),
    };
}

describe("DELETE /api/comments/[id]", () => {
    beforeEach(() => {
        findOneMock.mockReset();
        updateOneMock.mockClear();
        postMock.mockReset().mockResolvedValue({ visibility: true, userId: "author1" });
    });

    it("lets the owner delete their own comment", async () => {
        authMock.mockResolvedValue({ user: { id: "owner1", role: "reader" } });
        const comment = makeComment({ userId: "owner1" });
        findOneMock.mockResolvedValue(comment);

        const response = await DELETE(new NextRequest("http://localhost/api/comments/c1", { method: "DELETE" }), context("6500000000000000000000c1"));

        expect(response.status).toBe(200);
        expect(findOneMock).toHaveBeenCalledWith({ _id: "6500000000000000000000c1", userId: "owner1" });
        expect(comment.delete).toHaveBeenCalledWith("owner1");
    });

    it("blocks a non-owner, non-moderator from deleting someone else's comment", async () => {
        authMock.mockResolvedValue({ user: { id: "other1", role: "author" } });
        findOneMock.mockResolvedValue(null); // scoped filter excludes it, so lookup returns nothing

        const response = await DELETE(new NextRequest("http://localhost/api/comments/c1", { method: "DELETE" }), context("6500000000000000000000c1"));

        expect(response.status).toBe(404);
        expect(findOneMock).toHaveBeenCalledWith({ _id: "6500000000000000000000c1", userId: "other1" });
    });

    it("lets a moderator delete a comment they don't own", async () => {
        authMock.mockResolvedValue({ user: { id: "mod1", role: "moderator" } });
        const comment = makeComment({ userId: "owner1" });
        findOneMock.mockResolvedValue(comment);

        const response = await DELETE(new NextRequest("http://localhost/api/comments/c1", { method: "DELETE" }), context("6500000000000000000000c1"));

        expect(response.status).toBe(200);
        expect(findOneMock).toHaveBeenCalledWith({ _id: "6500000000000000000000c1" });
        expect(comment.delete).toHaveBeenCalledWith("mod1");
    });

    it("doesn't let a moderator delete a comment under someone else's private post", async () => {
        authMock.mockResolvedValue({ user: { id: "mod1", role: "moderator" } });
        const comment = makeComment({ userId: "owner1" });
        findOneMock.mockResolvedValue(comment);
        postMock.mockResolvedValue({ visibility: false, userId: "author1" });

        const response = await DELETE(new NextRequest("http://localhost/api/comments/c1", { method: "DELETE" }), context("6500000000000000000000c1"));

        expect(response.status).toBe(404);
        expect(comment.delete).not.toHaveBeenCalled();
    });

    it("lets a moderator delete comments under their own private post", async () => {
        authMock.mockResolvedValue({ user: { id: "mod1", role: "moderator" } });
        const comment = makeComment({ userId: "owner1" });
        findOneMock.mockResolvedValue(comment);
        postMock.mockResolvedValue({ visibility: false, userId: "mod1" });

        expect((await DELETE(new NextRequest("http://localhost/api/comments/c1", { method: "DELETE" }), context("6500000000000000000000c1"))).status).toBe(200);
    });
});

describe("PATCH /api/comments/[id]", () => {
    it("refuses edits to a comment under someone else's private post", async () => {
        authMock.mockResolvedValue({ user: { id: "owner1", role: "reader" } });
        findOneMock.mockReturnValue({ postId: "post1" });
        postMock.mockResolvedValue({ visibility: false, userId: "author1" });
        updateCommentMock.mockReset();
        const request = new NextRequest("http://localhost/api/comments/507f1f77bcf86cd799439011", {
            method: "PATCH",
            headers: { "x-forwarded-for": "10.0.9.2" },
            body: JSON.stringify({ content: "edited" }),
        });
        expect((await PATCH(request, context("507f1f77bcf86cd799439011"))).status).toBe(404);
        expect(updateCommentMock).not.toHaveBeenCalled();
    });

    it("refuses edits when COMMENTS_ENABLED=false", async () => {
        vi.stubEnv("COMMENTS_ENABLED", "false");
        try {
            authMock.mockResolvedValue({ user: { id: "owner1", role: "reader" } });
            const request = new NextRequest("http://localhost/api/comments/507f1f77bcf86cd799439011", {
                method: "PATCH",
                headers: { "x-forwarded-for": "10.0.9.1" },
                body: JSON.stringify({ content: "edited" }),
            });
            const response = await PATCH(request, context("507f1f77bcf86cd799439011"));
            expect(response.status).toBe(403);
        } finally {
            vi.unstubAllEnvs();
        }
    });
});
