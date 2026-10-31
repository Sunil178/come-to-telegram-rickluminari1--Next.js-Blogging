import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const leanMock = vi.fn();
const updateOneMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: {
        findById: () => ({ select: () => ({ lean: leanMock }) }),
        updateOne: (...args: unknown[]) => updateOneMock(...args),
    },
}));

const { GET, PUT } = await import("@/app/api/notifications/preferences/route");

const put = (body: unknown) =>
    PUT(new NextRequest("http://localhost/api/notifications/preferences", { method: "PUT", body: JSON.stringify(body) }), {});

describe("/api/notifications/preferences", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "user-1", role: "reader" } });
        leanMock.mockReset().mockResolvedValue({ notificationPrefs: { votes: { inApp: true, push: false } } });
        updateOneMock.mockReset().mockResolvedValue({});
    });

    it("requires a session", async () => {
        authMock.mockResolvedValue(null);
        expect((await GET(new NextRequest("http://localhost/api/notifications/preferences"), {})).status).toBe(401);
    });

    it("returns every category, defaulting unset ones to on", async () => {
        const body = await (await GET(new NextRequest("http://localhost/api/notifications/preferences"), {})).json();
        expect(body.data.votes).toEqual({ inApp: true, push: false });
        expect(body.data.replies).toEqual({ inApp: true, push: true });
    });

    it("stores only known categories with boolean channels", async () => {
        const response = await put({ preferences: { votes: { inApp: false, push: false } } });

        expect(response.status).toBe(200);
        const [filter, update] = updateOneMock.mock.calls[0];
        expect(filter).toEqual({ _id: "user-1" });
        expect(update.$set.notificationPrefs.votes).toEqual({ inApp: false, push: false });
        expect(update.$set.notificationPrefs.comments).toEqual({ inApp: true, push: true });
    });

    it.each([
        [{ preferences: { unknown: { inApp: true, push: true } } }],
        [{ preferences: { votes: { inApp: "no", push: true } } }],
        [{ preferences: { votes: { inApp: true } } }],
        [{ preferences: { $where: { inApp: true, push: true } } }],
        [{ preferences: [] }],
        [null],
    ])("rejects malformed input %#", async (body) => {
        expect((await put(body)).status).toBe(400);
        expect(updateOneMock).not.toHaveBeenCalled();
    });
});
