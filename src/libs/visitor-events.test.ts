import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const updateManyMock = vi.fn();
const deleteManyMock = vi.fn();
vi.mock("@/models/VisitorEvent", () => ({
    default: {
        create: (...args: unknown[]) => createMock(...args),
        updateMany: (...args: unknown[]) => updateManyMock(...args),
        deleteMany: (...args: unknown[]) => deleteManyMock(...args),
    },
}));

const { forgetVisitor, recordPostView, stitchVisitor } = await import("@/libs/visitor-events");

describe("visitor events", () => {
    beforeEach(() => {
        for (const mock of [createMock, updateManyMock, deleteManyMock]) mock.mockReset().mockResolvedValue({});
    });

    it("records a post view", async () => {
        await recordPostView({ visitorId: "v1", userId: null, postId: "p1" });
        expect(createMock).toHaveBeenCalledWith({ visitorId: "v1", userId: null, postId: "p1", type: "post_view" });
    });

    it("stitches only the visitor's anonymous events to the account", async () => {
        await stitchVisitor("v1", "u1");
        expect(updateManyMock).toHaveBeenCalledWith({ visitorId: "v1", userId: null }, { $set: { userId: "u1" } });
    });

    it("forgets only anonymous events (account history stays with the account)", async () => {
        await forgetVisitor("v1");
        expect(deleteManyMock).toHaveBeenCalledWith({ visitorId: "v1", userId: null });
    });

    it("never throws", async () => {
        createMock.mockRejectedValue(new Error("down"));
        updateManyMock.mockRejectedValue(new Error("down"));
        deleteManyMock.mockRejectedValue(new Error("down"));
        await expect(recordPostView({ visitorId: "v1", userId: null, postId: "p1" })).resolves.toBeUndefined();
        await expect(stitchVisitor("v1", "u1")).resolves.toBeUndefined();
        await expect(forgetVisitor("v1")).resolves.toBeUndefined();
    });
});
