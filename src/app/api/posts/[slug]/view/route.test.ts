import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const updateOneMock = vi.fn();
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: { updateOne: (...args: unknown[]) => updateOneMock(...args) },
    };
});

const createViewMock = vi.fn();
vi.mock("@/models/PostView", async () => {
    const actual = await vi.importActual<typeof import("@/models/PostView")>("@/models/PostView");
    return {
        ...actual,
        default: { create: (...args: unknown[]) => createViewMock(...args) },
    };
});

const { POST } = await import("@/app/api/posts/[slug]/view/route");

function context(slug: string) {
    return { params: Promise.resolve({ slug }) };
}

function viewRequest(options: { cookie?: string; ip?: string } = {}) {
    const headers: Record<string, string> = {};
    if (options.cookie) headers["cookie"] = options.cookie;
    if (options.ip) headers["x-forwarded-for"] = options.ip;
    return new NextRequest("http://localhost/api/posts/some-slug/view", { method: "POST", headers });
}

describe("POST /api/posts/[slug]/view", () => {
    beforeEach(() => {
        updateOneMock.mockReset();
        createViewMock.mockReset();
    });

    it("skips the DB entirely when the visitor already has the dedupe cookie", async () => {
        const response = await POST(viewRequest({ cookie: "viewed:some-slug=1" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(createViewMock).not.toHaveBeenCalled();
        expect(updateOneMock).not.toHaveBeenCalled();
    });

    it("increments the view count and sets the cookie for a genuinely new (slug, IP) pair", async () => {
        createViewMock.mockResolvedValue({});

        const response = await POST(viewRequest({ ip: "9.9.9.9" }), context("some-slug"));

        expect(createViewMock).toHaveBeenCalledWith(expect.objectContaining({ slug: "some-slug" }));
        expect(updateOneMock).toHaveBeenCalledWith(
            { slug: "some-slug", approval: "Approved", published: true, visibility: true },
            { $inc: { visitorCount: 1 } }
        );
        expect(response.headers.get("set-cookie")).toContain("viewed:some-slug=1");
    });

    it("does not double-count a repeat IP that never sends the cookie back", async () => {
        const duplicateKeyError = Object.assign(new Error("duplicate key"), { code: 11000 });
        createViewMock.mockRejectedValue(duplicateKeyError);

        const response = await POST(viewRequest({ ip: "9.9.9.9" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(updateOneMock).not.toHaveBeenCalled();
        expect(response.headers.get("set-cookie")).toContain("viewed:some-slug=1");
    });

    it("returns 500 and does not increment when PostView.create fails for a reason other than a duplicate", async () => {
        createViewMock.mockRejectedValue(new Error("connection lost"));

        const response = await POST(viewRequest({ ip: "9.9.9.9" }), context("some-slug"));

        expect(response.status).toBe(500);
        expect(updateOneMock).not.toHaveBeenCalled();
    });
});
