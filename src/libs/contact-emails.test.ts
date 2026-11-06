import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMailMock = vi.fn();
vi.mock("@/libs/mailer", () => ({ sendMail: (...args: unknown[]) => sendMailMock(...args) }));

const { sendContactAcknowledgement } = await import("@/libs/contact-emails");

describe("sendContactAcknowledgement", () => {
    beforeEach(() => sendMailMock.mockReset().mockResolvedValue(true));

    // Anyone can type any address, so nothing the sender typed may reach that inbox.
    it("repeats only the reference and topic, never the sender's name or message", async () => {
        const submitted = { name: "URGENT verify at https://evil.example", message: "Click https://evil.example", email: "victim@example.com", topic: "question" as const, reference: "C-ABCDEFGH" };
        await sendContactAcknowledgement(submitted);
        const mail = sendMailMock.mock.calls[0][0];
        expect(mail.to).toBe("victim@example.com");
        expect(mail.subject).toContain("C-ABCDEFGH");
        expect(`${mail.subject}${mail.text}${mail.html}`).not.toContain("evil.example");
    });
});
