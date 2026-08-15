import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const findOneAndUpdateMock = vi.fn();
const softDeleteMock = vi.fn();
vi.mock("@/models/Category", () => ({
    default: {
        findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args),
        delete: (...args: unknown[]) => softDeleteMock(...args),
    },
}));

const existsMock = vi.fn();
vi.mock("@/models/Post", () => ({
    default: { exists: (...args: unknown[]) => existsMock(...args) },
}));

const { PATCH, DELETE } = await import("@/app/api/categories/[id]/route");

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/categories/[id]", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
    });

    it("rejects an empty title", async () => {
        const request = new NextRequest("http://localhost/api/categories/c1", { method: "PATCH", body: JSON.stringify({ title: "" }) });
        const response = await PATCH(request, context("c1"));
        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("updates the title and re-derives the slug", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "c1", title: "AI & ML", slug: "ai-ml" });
        const request = new NextRequest("http://localhost/api/categories/c1", { method: "PATCH", body: JSON.stringify({ title: "AI & ML" }) });
        const response = await PATCH(request, context("c1"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith({ _id: "c1" }, { title: "AI & ML", slug: "ai-ml" }, { new: true });
    });
});

describe("DELETE /api/categories/[id]", () => {
    beforeEach(() => {
        softDeleteMock.mockReset();
        existsMock.mockReset();
    });

    it("blocks deleting a category that still has posts", async () => {
        existsMock.mockResolvedValue({ _id: "p1" });
        const response = await DELETE(new NextRequest("http://localhost/api/categories/c1", { method: "DELETE" }), context("c1"));

        expect(response.status).toBe(400);
        expect(softDeleteMock).not.toHaveBeenCalled();
    });

    it("soft-deletes a category with no posts", async () => {
        existsMock.mockResolvedValue(null);
        softDeleteMock.mockResolvedValue({ matchedCount: 1 });
        const response = await DELETE(new NextRequest("http://localhost/api/categories/c1", { method: "DELETE" }), context("c1"));

        expect(response.status).toBe(200);
        expect(softDeleteMock).toHaveBeenCalledWith({ _id: "c1" }, "admin1");
    });
});
