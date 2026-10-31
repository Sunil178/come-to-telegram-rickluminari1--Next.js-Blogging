import { beforeEach, describe, expect, it, vi } from "vitest";

const leanMock = vi.fn();
vi.mock("mongoose", () => ({
    default: { model: () => ({ findById: () => ({ select: () => ({ lean: leanMock }) }) }) },
}));

const { default: authConfig } = await import("@/auth.config");
const jwt = authConfig.callbacks.jwt as unknown as (args: { token: Record<string, unknown>; user?: Record<string, unknown> }) => Promise<Record<string, unknown> | null>;

describe("jwt callback", () => {
    beforeEach(() => leanMock.mockReset());

    it("stamps the sign-in time on new sessions", async () => {
        const token = await jwt({ token: {}, user: { id: "u1", username: "a", role: "reader" } });
        expect(token?.authAt).toEqual(expect.any(Number));
    });

    it("revokes a session that started before the last password change", async () => {
        leanMock.mockResolvedValueOnce({ role: "reader", passwordChangedAt: new Date(2_000) });
        expect(await jwt({ token: { id: "u1", authAt: 1_000, roleCheckedAt: 0 } })).toBeNull();
    });

    it("keeps sessions that started after it, refreshing the role", async () => {
        leanMock.mockResolvedValueOnce({ role: "author", passwordChangedAt: new Date(1_000) });
        const token = await jwt({ token: { id: "u1", authAt: 2_000, roleCheckedAt: 0, role: "reader" } });
        expect(token?.role).toBe("author");
    });

    it("revokes the session of an account that no longer exists", async () => {
        leanMock.mockResolvedValueOnce(null);
        expect(await jwt({ token: { id: "u1", authAt: 2_000, roleCheckedAt: 0, role: "admin" } })).toBeNull();
    });
});
