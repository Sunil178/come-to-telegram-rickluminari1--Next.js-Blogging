import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMailMock = vi.fn();
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
vi.mock("nodemailer", () => ({ default: { createTransport: (...args: unknown[]) => createTransportMock(...(args as [])) } }));

const message = { to: "a@example.com", subject: "Hi", text: "t", html: "<p>t</p>" };

async function load() {
    vi.resetModules();
    return import("@/libs/mailer");
}

describe("sendMail", () => {
    beforeEach(() => {
        sendMailMock.mockReset().mockResolvedValue({});
        createTransportMock.mockClear();
    });
    afterEach(() => vi.unstubAllEnvs());

    it("does nothing and reports false when SMTP isn't configured", async () => {
        vi.stubEnv("SMTP_HOST", "");
        const { isMailConfigured, sendMail } = await load();

        expect(isMailConfigured()).toBe(false);
        expect(await sendMail(message)).toBe(false);
        expect(createTransportMock).not.toHaveBeenCalled();
    });

    it("sends through the configured SMTP server with file and URL access disabled", async () => {
        vi.stubEnv("SMTP_HOST", "smtp.example.com");
        vi.stubEnv("SMTP_PORT", "465");
        vi.stubEnv("SMTP_USER", "user");
        vi.stubEnv("SMTP_PASSWORD", "pass");
        vi.stubEnv("MAIL_FROM", "Blog <blog@example.com>");
        const { sendMail } = await load();

        expect(await sendMail(message)).toBe(true);
        expect(createTransportMock).toHaveBeenCalledWith(expect.objectContaining({
            host: "smtp.example.com",
            port: 465,
            secure: true,
            auth: { user: "user", pass: "pass" },
            disableFileAccess: true,
            disableUrlAccess: true,
        }));
        expect(sendMailMock).toHaveBeenCalledWith({ from: "Blog <blog@example.com>", ...message });
    });

    it("never throws when delivery fails", async () => {
        vi.stubEnv("SMTP_HOST", "smtp.example.com");
        sendMailMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
        const { sendMail } = await load();

        expect(await sendMail(message)).toBe(false);
    });
});
