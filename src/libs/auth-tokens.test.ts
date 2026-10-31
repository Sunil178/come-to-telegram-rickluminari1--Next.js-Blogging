import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateOneMock = vi.fn();
const findOneAndDeleteMock = vi.fn();
vi.mock("@/models/AuthToken", () => ({
    default: {
        updateOne: (...args: unknown[]) => updateOneMock(...args),
        findOneAndDelete: (...args: unknown[]) => findOneAndDeleteMock(...args),
    },
}));

const { consumeAuthToken, createAuthToken, TOKEN_LIFETIME_MS } = await import("@/libs/auth-tokens");

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

describe("auth tokens", () => {
    beforeEach(() => {
        updateOneMock.mockReset().mockResolvedValue({});
        findOneAndDeleteMock.mockReset();
    });

    it("stores only the hash of a random token, replacing the earlier token for the same purpose in one upsert", async () => {
        const token = await createAuthToken("user-1", "reset-password");

        expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        const [filter, update, options] = updateOneMock.mock.calls[0];
        expect(filter).toEqual({ userId: "user-1", purpose: "reset-password" });
        expect(options).toEqual({ upsert: true });
        const stored = update.$set;
        expect(stored.tokenHash).toBe(sha256(token));
        expect(JSON.stringify(stored)).not.toContain(token);
        const lifetime = stored.expiresAt.getTime() - Date.now();
        expect(lifetime).toBeGreaterThan(TOKEN_LIFETIME_MS["reset-password"] - 5_000);
        expect(lifetime).toBeLessThanOrEqual(TOKEN_LIFETIME_MS["reset-password"]);
    });

    it("issues different tokens each time", async () => {
        expect(await createAuthToken("u", "verify-email")).not.toBe(await createAuthToken("u", "verify-email"));
    });

    it("consumes an unexpired token of the right purpose exactly once", async () => {
        findOneAndDeleteMock.mockResolvedValueOnce({ userId: { toString: () => "user-1" } });

        expect(await consumeAuthToken("raw-token", "verify-email")).toBe("user-1");
        const [filter] = findOneAndDeleteMock.mock.calls[0];
        expect(filter.tokenHash).toBe(sha256("raw-token"));
        expect(filter.purpose).toBe("verify-email");
        expect(filter.expiresAt.$gt).toBeInstanceOf(Date);
    });

    it("returns null for unknown, expired, reused or malformed tokens", async () => {
        findOneAndDeleteMock.mockResolvedValue(null);
        expect(await consumeAuthToken("nope", "reset-password")).toBeNull();
        expect(await consumeAuthToken("", "reset-password")).toBeNull();
        expect(await consumeAuthToken({ $ne: null } as unknown as string, "reset-password")).toBeNull();
        expect(findOneAndDeleteMock).toHaveBeenCalledTimes(1);
    });
});
