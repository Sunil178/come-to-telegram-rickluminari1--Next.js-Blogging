import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const createMock = vi.fn();
vi.mock("@/models/Category", () => ({
    default: { create: (...args: unknown[]) => createMock(...args) },
}));

const { POST } = await import("@/app/api/categories/route");

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/categories", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/categories", () => {
    beforeEach(() => {
        createMock.mockReset();
    });

    it("rejects an empty title", async () => {
        const response = await POST(requestWithBody({ title: "  " }), {});
        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("creates a category, deriving the slug from the title", async () => {
        createMock.mockResolvedValue({ _id: "c1", title: "Deep Learning", slug: "deep-learning" });
        const response = await POST(requestWithBody({ title: "Deep Learning" }), {});

        expect(response.status).toBe(200);
        expect(createMock).toHaveBeenCalledWith({ title: "Deep Learning", slug: "deep-learning", visibility: true });
    });

    it("returns 409 on a duplicate slug", async () => {
        createMock.mockRejectedValue({ code: 11000 });
        const response = await POST(requestWithBody({ title: "Deep Learning" }), {});
        expect(response.status).toBe(409);
    });
});
