import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: (fn: () => unknown) => fn() };
});

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "mod1", role: "moderator" } }),
}));

const findOneAndUpdateMock = vi.fn();
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: {
            findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args),
        },
    };
});

const notifyMock = vi.fn();
vi.mock("@/libs/notify", () => ({ notify: (...args: unknown[]) => notifyMock(...args) }));

const { PATCH } = await import("@/app/api/posts/[slug]/approval/route");

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/posts/some-slug/approval", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

function context(slug: string) {
    return { params: Promise.resolve({ slug }) };
}

describe("PATCH /api/posts/[slug]/approval", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
        notifyMock.mockReset();
    });

    it("rejects a body with an invalid approval value", async () => {
        const response = await PATCH(requestWithBody({ approval: "Deleted" }), context("some-slug"));

        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("returns 404 when the post doesn't exist", async () => {
        findOneAndUpdateMock.mockResolvedValue(null);
        const response = await PATCH(requestWithBody({ approval: "Approved" }), context("missing-slug"));

        expect(response.status).toBe(404);
    });

    it("approves a post, stamps approvedAt, and makes it publicly visible", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug", approval: "Approved" });
        const response = await PATCH(requestWithBody({ approval: "Approved" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug" },
            expect.objectContaining({
                approval: "Approved",
                approvedAt: expect.any(Date),
                published: true,
                publishedAt: expect.any(Date),
            }),
            { returnDocument: "before" }
        );
    });

    it("rejects a post, clears approvedAt, and leaves published untouched", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug", approval: "Rejected" });
        const response = await PATCH(requestWithBody({ approval: "Rejected" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug" },
            expect.objectContaining({ approval: "Rejected", approvedAt: null }),
            { returnDocument: "before" }
        );
        const updatePayload = findOneAndUpdateMock.mock.calls[0][1];
        expect(updatePayload).not.toHaveProperty("published");
        expect(updatePayload).not.toHaveProperty("publishedAt");
    });

    it("notifies the post's author on approval", async () => {
        findOneAndUpdateMock.mockResolvedValue({
            _id: "post-1",
            slug: "some-slug",
            title: "Docker for Developers",
            approval: "Pending",
            userId: "author-1",
        });

        await PATCH(requestWithBody({ approval: "Approved" }), context("some-slug"));

        expect(notifyMock).toHaveBeenCalledWith(
            expect.objectContaining({ recipientId: "author-1", type: "post_approved", postId: "post-1" })
        );
    });

    it("notifies the post's author on rejection", async () => {
        findOneAndUpdateMock.mockResolvedValue({
            _id: "post-1",
            slug: "some-slug",
            title: "Docker for Developers",
            approval: "Pending",
            userId: "author-1",
        });

        await PATCH(requestWithBody({ approval: "Rejected" }), context("some-slug"));

        expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "author-1", type: "post_rejected" }));
    });

    it("still delegates the self-approval case to notify's own guard, passing matching ids", async () => {
        findOneAndUpdateMock.mockResolvedValue({
            _id: "post-1",
            slug: "some-slug",
            title: "Docker for Developers",
            approval: "Pending",
            userId: "mod1",
        });

        await PATCH(requestWithBody({ approval: "Approved" }), context("some-slug"));

        expect(notifyMock).toHaveBeenCalledWith(
            expect.objectContaining({ recipientId: "mod1", actorId: "mod1" })
        );
    });

    it("re-applies the update but doesn't re-notify when the post already has the requested status", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "post-1", slug: "some-slug", approval: "Approved", userId: "author-1" });

        const response = await PATCH(requestWithBody({ approval: "Approved" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ data: { slug: "some-slug", approval: "Approved" } });
        expect(findOneAndUpdateMock).toHaveBeenCalledWith({ slug: "some-slug" }, expect.objectContaining({ published: true }), { returnDocument: "before" });
        expect(notifyMock).not.toHaveBeenCalled();
    });
});
