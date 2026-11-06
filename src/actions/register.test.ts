import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let clientIp = "10.9.0.1";
let cookieJar: Record<string, string> = {};
vi.mock("next/headers", () => ({
    headers: async () => new Headers({ "x-forwarded-for": clientIp }),
    cookies: async () => ({ get: (name: string) => (name in cookieJar ? { value: cookieJar[name] } : undefined) }),
}));
const stitchMock = vi.fn();
vi.mock("@/libs/visitor-events", () => ({ stitchVisitor: (...args: unknown[]) => stitchMock(...args) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("bcrypt", () => ({ hash: async () => "hashed" }));
vi.mock("next/server", () => ({ after: (callback: () => unknown) => callback() }));
let mailConfigured = false;
vi.mock("@/libs/mailer", () => ({ isMailConfigured: () => mailConfigured }));
const sendVerificationMock = vi.fn();
vi.mock("@/libs/account-emails", () => ({ sendVerificationEmail: (...args: unknown[]) => sendVerificationMock(...args) }));

const findOneMock = vi.fn();
const createMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: { findOne: (...args: unknown[]) => ({ collation: () => findOneMock(...args) }), create: (...args: unknown[]) => createMock(...args) },
}));

const recordSignupMock = vi.fn();
vi.mock("@/libs/ip-history", () => ({ recordSignupIp: (...args: unknown[]) => recordSignupMock(...args) }));

const { registerAction } = await import("@/actions/register");

function form(overrides: Record<string, string> = {}) {
    const data = new FormData();
    const fields = { username: "newuser", firstName: "New", lastName: "User", email: "new@example.com", password: "secret123", password_confirmation: "secret123", ageConfirmed: "on", ...overrides };
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
}

describe("registerAction rate limiting", () => {
    beforeEach(() => {
        findOneMock.mockReset().mockResolvedValue(null);
        createMock.mockReset().mockResolvedValue({});
    });

    it("requires a password of at least 8 characters", async () => {
        const state = await registerAction({}, form({ password: "abc1234", password_confirmation: "abc1234" }));
        expect(state.validationErrors?.password).toBeDefined();
        expect(createMock).not.toHaveBeenCalled();
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

describe("registerAction when sign-up is closed", () => {
    beforeEach(() => {
        findOneMock.mockReset().mockResolvedValue(null);
        createMock.mockReset().mockResolvedValue({});
        clientIp = "10.9.3.1";
    });
    afterEach(() => vi.unstubAllEnvs());

    it("refuses to create an account when SIGNUP_ENABLED=false", async () => {
        vi.stubEnv("SIGNUP_ENABLED", "false");
        const state = await registerAction({}, form({ email: "closed@example.com", username: "closed", ageConfirmed: "on" }));
        expect(state.error).toMatch(/Sign-up is closed/);
        expect(createMock).not.toHaveBeenCalled();
    });
});

describe("registerAction age and terms", () => {
    beforeEach(() => {
        findOneMock.mockReset().mockResolvedValue(null);
        createMock.mockReset().mockResolvedValue({ id: "u-age", email: "a@example.com", username: "ageok" });
        clientIp = "10.9.4.1";
    });

    it("requires confirming age 18+ and accepting the terms", async () => {
        const data = form({ email: "minor@example.com", username: "minor" });
        data.delete("ageConfirmed");
        const state = await registerAction({}, data);
        expect(state.validationErrors?.ageConfirmed).toBeDefined();
        expect(createMock).not.toHaveBeenCalled();
    });

    it("records when the terms were accepted", async () => {
        await registerAction({}, form({ email: "a@example.com", username: "ageok" }));
        expect(createMock.mock.calls[0][0].termsAcceptedAt).toBeInstanceOf(Date);
    });
});

describe("registerAction email verification", () => {
    beforeEach(() => {
        findOneMock.mockReset().mockResolvedValue(null);
        createMock.mockReset().mockResolvedValue({ id: "u1", email: "v@example.com", username: "verifyme" });
        sendVerificationMock.mockReset().mockResolvedValue(true);
        clientIp = "10.9.1.1";
    });

    it("creates the account unverified and emails a confirmation link when SMTP is configured", async () => {
        mailConfigured = true;
        await registerAction({}, form({ email: "v@example.com", username: "verifyme" }));

        expect(createMock.mock.calls[0][0].emailVerifiedAt).toBeNull();
        expect(sendVerificationMock).toHaveBeenCalledWith({ id: "u1", email: "v@example.com", username: "verifyme" });
    });

    it("records the address the account was created from", async () => {
        createMock.mockResolvedValue({ id: "u-new", email: "new@example.com", username: "newuser" });
        await registerAction({}, form({ email: `ip${Date.now()}@example.com` }));
        expect(recordSignupMock).toHaveBeenCalledWith("u-new", clientIp);
    });

    it("creates the account verified when SMTP isn't configured", async () => {
        mailConfigured = false;
        await registerAction({}, form({ email: "w@example.com", username: "noverify" }));

        expect(createMock.mock.calls[0][0].emailVerifiedAt).toBeInstanceOf(Date);
        expect(sendVerificationMock).not.toHaveBeenCalled();
    });
});

describe("registerAction identity stitching", () => {
    beforeEach(() => {
        findOneMock.mockReset().mockResolvedValue(null);
        createMock.mockReset().mockResolvedValue({ id: "u9", email: "s@example.com", username: "stitched" });
        stitchMock.mockReset();
        clientIp = "10.9.2.1";
        mailConfigured = false;
    });

    it("attaches a consenting visitor's anonymous events to the new account", async () => {
        cookieJar = { consent: "granted", vid: "0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10" };
        await registerAction({}, form({ email: "s@example.com", username: "stitched" }));
        expect(stitchMock).toHaveBeenCalledWith("0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10", "u9");
    });

    it("doesn't stitch without consent", async () => {
        cookieJar = { vid: "0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10" };
        await registerAction({}, form({ email: "t@example.com", username: "nostitch" }));
        expect(stitchMock).not.toHaveBeenCalled();
    });
});
