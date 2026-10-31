import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "10.9.0.1" }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("bcrypt", () => ({ hash: async () => "hashed" }));

const findOneMock = vi.fn();
const createMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: { findOne: (...args: unknown[]) => findOneMock(...args), create: (...args: unknown[]) => createMock(...args) },
}));

const { registerAction } = await import("@/actions/register");

function form(overrides: Record<string, string> = {}) {
    const data = new FormData();
    const fields = { username: "newuser", firstName: "New", lastName: "User", email: "new@example.com", password: "secret123", password_confirmation: "secret123", ...overrides };
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
}

describe("registerAction rate limiting", () => {
    beforeEach(() => {
        findOneMock.mockReset().mockResolvedValue(null);
        createMock.mockReset().mockResolvedValue({});
    });

    it("doesn't count submissions that fail validation", async () => {
        for (let i = 0; i < 12; i++) {
            const state = await registerAction({}, form({ email: "not-an-email" }));
            expect(state.validationErrors).toBeDefined();
        }
        expect(findOneMock).not.toHaveBeenCalled();
    });

    it("rejects the 11th valid attempt from one IP within the hour", async () => {
        for (let i = 0; i < 10; i++) await registerAction({}, form({ email: `u${i}@example.com`, username: `user${i}` }));
        const state = await registerAction({}, form({ email: "u10@example.com", username: "user10" }));

        expect(state.error).toMatch(/Too many registration attempts/);
        expect(createMock).toHaveBeenCalledTimes(10);
    });
});
