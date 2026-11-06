import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
    const actual = await vi.importActual<typeof import("next/server")>("next/server");
    return { ...actual, after: (fn: () => unknown) => fn() };
});

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const createMock = vi.fn();
vi.mock("@/models/ContactMessage", () => ({ default: { create: (...args: unknown[]) => createMock(...args) } }));
vi.mock("@/models/User", () => ({ default: { find: () => ({ select: () => ({ lean: async () => [{ _id: "admin1" }] }) }) } }));

const notifyMock = vi.fn();
vi.mock("@/libs/notify", () => ({ notify: (...args: unknown[]) => notifyMock(...args) }));
const operatorMailMock = vi.fn();
const ackMock = vi.fn();
vi.mock("@/libs/contact-emails", () => ({
    sendContactToOperator: (...args: unknown[]) => operatorMailMock(...args),
    sendContactAcknowledgement: (...args: unknown[]) => ackMock(...args),
}));

const { POST } = await import("@/app/api/contact/route");

// A distinct address per request keeps the route's rate limiter out of the way, except where a test shares one.
let requestCount = 0;
function contactRequest(body: unknown, ip = `10.1.0.${++requestCount}`) {
    return new NextRequest("http://localhost/api/contact", { method: "POST", headers: { "x-forwarded-for": ip }, body: JSON.stringify(body) });
}

const MESSAGE = { topic: "report", name: "Asha", email: "asha@example.com", url: "https://vedev.guru/posts/x", message: "This post copies my article word for word." };

describe("POST /api/contact", () => {
    beforeEach(() => {
        authMock.mockReset().mockResolvedValue(null);
        createMock.mockReset().mockResolvedValue({});
        notifyMock.mockReset();
        operatorMailMock.mockReset().mockResolvedValue(true);
        ackMock.mockReset().mockResolvedValue(true);
    });

    it("stores a visitor's message with a reference, emails both sides and tells the admins", async () => {
        const response = await POST(contactRequest(MESSAGE), {});
        expect(response.status).toBe(200);
        const { data } = await response.json();
        expect(data.reference).toMatch(/^C-/);
        expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ ...MESSAGE, reference: data.reference, userId: null }));
        expect(operatorMailMock).toHaveBeenCalledWith(expect.objectContaining({ reference: data.reference, username: null }));
        expect(ackMock).toHaveBeenCalledWith(expect.objectContaining({ reference: data.reference, email: "asha@example.com" }));
        expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "admin1", type: "contact_message", actorId: null }));
    });

    it("ties the message to the signed-in sender's account", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", username: "asha", role: "reader" } });
        await POST(contactRequest(MESSAGE), {});
        expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1" }));
        expect(operatorMailMock).toHaveBeenCalledWith(expect.objectContaining({ username: "asha" }));
    });

    it("refuses an invalid message without storing or sending anything", async () => {
        const response = await POST(contactRequest({ ...MESSAGE, email: "nope" }), {});
        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
        expect(ackMock).not.toHaveBeenCalled();
    });

    it("answers a bot that fills the hidden field as if it worked, but stores and sends nothing", async () => {
        const response = await POST(contactRequest({ ...MESSAGE, leave_empty: "Spam Inc" }), {});
        expect(response.status).toBe(200);
        expect(createMock).not.toHaveBeenCalled();
        expect(ackMock).not.toHaveBeenCalled();
    });

    it("allows five messages an hour from one address", async () => {
        for (let i = 0; i < 5; i++) expect((await POST(contactRequest(MESSAGE, "10.2.0.1"), {})).status).toBe(200);
        expect((await POST(contactRequest(MESSAGE, "10.2.0.1"), {})).status).toBe(429);
    });
});
