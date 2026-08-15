import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "mod1", role: "moderator" } }),
}));

const findOneAndUpdateMock = vi.fn();
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: { findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args) },
    };
});

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
            { new: true }
        );
    });

    it("rejects a post, clears approvedAt, and leaves published untouched", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug", approval: "Rejected" });
        const response = await PATCH(requestWithBody({ approval: "Rejected" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug" },
            expect.objectContaining({ approval: "Rejected", approvedAt: null }),
            { new: true }
        );
        const updatePayload = findOneAndUpdateMock.mock.calls[0][1];
        expect(updatePayload).not.toHaveProperty("published");
        expect(updatePayload).not.toHaveProperty("publishedAt");
    });
});
