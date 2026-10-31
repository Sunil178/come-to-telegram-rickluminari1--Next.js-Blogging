import { beforeEach, describe, expect, it, vi } from "vitest";

const afterCallbacks: Array<() => Promise<unknown> | unknown> = [];
vi.mock("next/server", () => ({ after: (callback: () => unknown) => afterCallbacks.push(callback) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "10.7.0.1" }) }));
const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({ redirect: (...args: unknown[]) => redirectMock(...args) }));
vi.mock("bcrypt", () => ({ hash: async (value: string) => `hashed:${value}` }));

let mailConfigured = true;
vi.mock("@/libs/mailer", () => ({ isMailConfigured: () => mailConfigured }));
const sendVerificationMock = vi.fn();
const sendResetMock = vi.fn();
vi.mock("@/libs/account-emails", () => ({
    sendVerificationEmail: (...args: unknown[]) => sendVerificationMock(...args),
    sendPasswordResetEmail: (...args: unknown[]) => sendResetMock(...args),
}));
const consumeTokenMock = vi.fn();
vi.mock("@/libs/auth-tokens", () => ({ consumeAuthToken: (...args: unknown[]) => consumeTokenMock(...args) }));
const findOneMock = vi.fn();
const updateOneMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: {
        findOne: (...args: unknown[]) => ({ collation: (collation: unknown) => findOneMock(...args, collation) }),
        updateOne: (...args: unknown[]) => updateOneMock(...args),
    },
}));

const { requestPasswordResetAction, resendVerificationAction, resetPasswordAction, verifyEmailAction } = await import("@/actions/account");

const form = (fields: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
};
const runAfter = async () => {
    for (const callback of afterCallbacks.splice(0)) await callback();
};
const user = { id: "u1", email: "known@example.com", username: "known" };

beforeEach(() => {
    afterCallbacks.length = 0;
    mailConfigured = true;
    redirectMock.mockReset();
    sendVerificationMock.mockReset().mockResolvedValue(true);
    sendResetMock.mockReset().mockResolvedValue(true);
    consumeTokenMock.mockReset();
    findOneMock.mockReset();
    updateOneMock.mockReset().mockResolvedValue({ matchedCount: 1 });
});

describe("requestPasswordResetAction", () => {
    it("answers known and unknown emails identically and only mails existing accounts", async () => {
        findOneMock.mockResolvedValueOnce(user).mockResolvedValueOnce(null);

        const known = await requestPasswordResetAction({}, form({ email: "reset-known@example.com" }));
        const unknown = await requestPasswordResetAction({}, form({ email: "reset-unknown@example.com" }));
        expect(known).toEqual(unknown);
        expect(findOneMock).not.toHaveBeenCalled();

        await runAfter();
        expect(sendResetMock).toHaveBeenCalledTimes(1);
        expect(sendResetMock).toHaveBeenCalledWith(user);
        expect(findOneMock).toHaveBeenCalledWith({ email: "reset-known@example.com" }, { locale: "en", strength: 2 });
    });

    it("rejects malformed input without a lookup", async () => {
        const state = await requestPasswordResetAction({}, form({ email: "nope" }));
        expect(state.error).toMatch(/valid email/);
        expect(afterCallbacks).toHaveLength(0);
    });

    it("limits requests per account", async () => {
        for (let i = 0; i < 3; i++) expect((await requestPasswordResetAction({}, form({ email: "victim@example.com" }))).message).toBeDefined();
        expect((await requestPasswordResetAction({}, form({ email: "victim@example.com" }))).error).toMatch(/Too many/);
    });

    it("says so when email isn't configured", async () => {
        mailConfigured = false;
        expect((await requestPasswordResetAction({}, form({ email: "a@example.com" }))).error).toMatch(/isn't set up/);
    });
});

describe("resendVerificationAction", () => {
    it("only looks up accounts explicitly awaiting verification, never legacy ones", async () => {
        findOneMock.mockResolvedValueOnce(user);
        const state = await resendVerificationAction({}, form({ email: "resend@example.com" }));
        expect(state.message).toBeDefined();

        await runAfter();
        expect(findOneMock).toHaveBeenCalledWith({ email: "resend@example.com", emailVerifiedAt: { $type: "null" } }, { locale: "en", strength: 2 });
        expect(sendVerificationMock).toHaveBeenCalledWith(user);
    });
});

describe("verifyEmailAction", () => {
    it("marks the account verified and sends the user to log in", async () => {
        consumeTokenMock.mockResolvedValueOnce("u1");
        await verifyEmailAction({}, form({ token: "t" }));

        expect(consumeTokenMock).toHaveBeenCalledWith("t", "verify-email");
        const [filter, pipeline, options] = updateOneMock.mock.calls[0];
        expect(filter).toEqual({ _id: "u1" });
        expect(pipeline[0].$set.emailVerifiedAt).toEqual({ $ifNull: ["$emailVerifiedAt", expect.any(Date)] });
        expect(options).toEqual({ updatePipeline: true });
        expect(redirectMock).toHaveBeenCalledWith("/auth/login?verified=1");
    });

    it("explains an invalid or expired link", async () => {
        consumeTokenMock.mockResolvedValueOnce(null);
        expect((await verifyEmailAction({}, form({ token: "bad" }))).error).toMatch(/invalid or has expired/);
        expect(updateOneMock).not.toHaveBeenCalled();
    });
});

describe("resetPasswordAction", () => {
    it("validates the new password before using up the link", async () => {
        const state = await resetPasswordAction({}, form({ token: "t", password: "abc", password_confirmation: "abc" }));
        expect(state.validationErrors?.password).toBeDefined();
        expect(consumeTokenMock).not.toHaveBeenCalled();
    });

    it("sets the new password, records the change for session revocation, and completes verification", async () => {
        consumeTokenMock.mockResolvedValueOnce("u1");
        await resetPasswordAction({}, form({ token: "t", password: "newsecret", password_confirmation: "newsecret" }));

        expect(consumeTokenMock).toHaveBeenCalledWith("t", "reset-password");
        expect(updateOneMock).toHaveBeenCalledTimes(1);
        const [filter, pipeline] = updateOneMock.mock.calls[0];
        expect(filter).toEqual({ _id: "u1" });
        expect(pipeline[0].$set).toEqual({
            password: { $literal: "hashed:newsecret" },
            passwordChangedAt: expect.any(Date),
            emailVerifiedAt: { $ifNull: ["$emailVerifiedAt", expect.any(Date)] },
        });
        expect(redirectMock).toHaveBeenCalledWith("/auth/login?reset=1");
    });

    it("reports an account deleted since the link was sent instead of claiming success", async () => {
        consumeTokenMock.mockResolvedValueOnce("u1");
        updateOneMock.mockResolvedValueOnce({ matchedCount: 0 });
        const state = await resetPasswordAction({}, form({ token: "t", password: "newsecret", password_confirmation: "newsecret" }));
        expect(state.error).toMatch(/no longer exists/);
        expect(redirectMock).not.toHaveBeenCalled();
    });

    it("refuses a used or expired link", async () => {
        consumeTokenMock.mockResolvedValueOnce(null);
        const state = await resetPasswordAction({}, form({ token: "t", password: "newsecret", password_confirmation: "newsecret" }));
        expect(state.error).toMatch(/invalid, expired or already used/);
        expect(updateOneMock).not.toHaveBeenCalled();
    });
});
