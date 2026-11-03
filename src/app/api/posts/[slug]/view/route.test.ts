import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const updateOneMock = vi.fn();
const findOneMock = vi.fn();
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: {
            findOneAndUpdate: (...args: unknown[]) => updateOneMock(...args),
            findOne: (...args: unknown[]) => ({ select: () => ({ lean: () => findOneMock(...args) }) }),
        },
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

const recordPostViewMock = vi.fn();
vi.mock("@/libs/visitor-events", () => ({ recordPostView: (...args: unknown[]) => recordPostViewMock(...args) }));

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
        updateOneMock.mockReset().mockResolvedValue({ _id: "post-1" });
        createViewMock.mockReset();
        recordPostViewMock.mockReset();
        findOneMock.mockReset().mockResolvedValue({ _id: "post-1" });
        authMock.mockResolvedValue(null);
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
            { slug: "some-slug", approval: "Approved", published: true, visibility: true, publishedAt: { $lte: expect.any(Date) } },
            { $inc: { visitorCount: 1 } },
            { projection: { _id: 1 } }
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

    it("records an interest event only for a consenting visitor, with the user when signed in", async () => {
        createViewMock.mockResolvedValue({});
        await POST(viewRequest({ ip: "9.9.9.1", cookie: "vid=0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10" }), context("some-slug"));
        expect(recordPostViewMock).not.toHaveBeenCalled();

        authMock.mockResolvedValue({ user: { id: "user-7" } });
        await POST(viewRequest({ ip: "9.9.9.2", cookie: "consent=granted; vid=0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10" }), context("some-slug"));
        expect(recordPostViewMock).toHaveBeenCalledWith({ visitorId: "0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10", userId: "user-7", postId: "post-1" });
    });

    it("ignores a forged visitor id and records nothing for a declined consent", async () => {
        createViewMock.mockResolvedValue({});
        await POST(viewRequest({ ip: "9.9.9.3", cookie: "consent=granted; vid=../../etc" }), context("some-slug"));
        await POST(viewRequest({ ip: "9.9.9.4", cookie: "consent=denied; vid=0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10" }), context("some-slug"));
        expect(recordPostViewMock).not.toHaveBeenCalled();
    });

    it("records a consenting visitor's interest even when their IP was already counted", async () => {
        createViewMock.mockRejectedValue(Object.assign(new Error("dup"), { code: 11000 }));
        await POST(viewRequest({ ip: "9.9.9.5", cookie: "consent=granted; vid=0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10" }), context("some-slug"));

        expect(updateOneMock).not.toHaveBeenCalled();
        expect(recordPostViewMock).toHaveBeenCalledWith({ visitorId: "0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10", userId: null, postId: "post-1" });
    });
});
