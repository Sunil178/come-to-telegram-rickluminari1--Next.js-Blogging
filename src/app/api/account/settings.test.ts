import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn().mockResolvedValue({ user: { id: "u1", role: "reader" } });
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findUserMock = vi.fn();
const updateOneMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: {
        findById: () => ({ select: () => ({ lean: findUserMock }) }),
        updateOne: (...args: unknown[]) => updateOneMock(...args),
        findOneAndUpdate: (...args: unknown[]) => {
            updateOneMock(args[0], args[1]);
            return { select: () => ({ lean: async () => ({ avatar: previousAvatar }) }) };
        },
    },
}));
let previousAvatar = "";
const removeUploadMock = vi.fn();
vi.mock("@/libs/upload-cleanup", () => ({ removeUploadIfUnused: (...args: unknown[]) => removeUploadMock(...args) }));
vi.mock("bcrypt", () => ({
    compare: async (plain: string, hashed: string) => hashed === `hash:${plain}`,
    hash: async (plain: string) => `hash:${plain}`,
}));
const saveImageMock = vi.fn();
vi.mock("@/libs/image-upload", () => ({ saveUploadedImage: (...args: unknown[]) => saveImageMock(...args) }));

const { PATCH } = await import("@/app/api/account/profile/route");
const { POST: changePassword } = await import("@/app/api/account/password/route");
const { POST: uploadAvatar, DELETE: removeAvatar } = await import("@/app/api/account/avatar/route");

let ip = 0;
function jsonRequest(method: string, body: unknown) {
    ip += 1;
    return new NextRequest("http://localhost/api/account/x", { method, body: JSON.stringify(body), headers: { "x-forwarded-for": `10.7.0.${ip}` } });
}

beforeEach(() => {
    updateOneMock.mockReset();
    findUserMock.mockReset().mockResolvedValue({ password: "hash:old-password" });
    saveImageMock.mockReset();
});

describe("PATCH /api/account/profile", () => {
    it("saves valid public and private fields on the signed-in account only", async () => {
        const response = await PATCH(jsonRequest("PATCH", { bio: "Hello", phone: "+1 555 0100", role: "admin" }), {});
        expect(response.status).toBe(200);
        expect(updateOneMock).toHaveBeenCalledWith({ _id: "u1" }, { $set: { "profile.bio": "Hello", "privateDetails.phone": "+1 555 0100" } });
    });

    it("refuses invalid input without saving", async () => {
        const response = await PATCH(jsonRequest("PATCH", { website: "not a url" }), {});
        expect(response.status).toBe(400);
        expect(updateOneMock).not.toHaveBeenCalled();
    });

    it("requires a session", async () => {
        authMock.mockResolvedValueOnce(null);
        expect((await PATCH(jsonRequest("PATCH", { bio: "x" }), {})).status).toBe(401);
    });
});

describe("POST /api/account/password", () => {
    const change = (body: Record<string, string>) => changePassword(jsonRequest("POST", body), {});

    it("changes the password and stamps passwordChangedAt, which signs other sessions out", async () => {
        const response = await change({ currentPassword: "old-password", password: "new-password", passwordConfirmation: "new-password" });
        expect(response.status).toBe(200);
        expect(updateOneMock).toHaveBeenCalledWith({ _id: "u1" }, { $set: { password: "hash:new-password", passwordChangedAt: expect.any(Date) } });
    });

    it("refuses a wrong current password, a short or mismatched new one, and reusing the old one", async () => {
        expect((await change({ currentPassword: "wrong", password: "new-password", passwordConfirmation: "new-password" })).status).toBe(403);
        expect((await change({ currentPassword: "old-password", password: "short", passwordConfirmation: "short" })).status).toBe(400);
        expect((await change({ currentPassword: "old-password", password: "new-password", passwordConfirmation: "other-password" })).status).toBe(400);
        expect((await change({ currentPassword: "old-password", password: "old-password", passwordConfirmation: "old-password" })).status).toBe(400);
        expect(updateOneMock).not.toHaveBeenCalled();
    });
});

describe("/api/account/avatar", () => {
    function upload() {
        const form = new FormData();
        form.set("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "me.jpg", { type: "image/jpeg" }));
        return new NextRequest("http://localhost/api/account/avatar", { method: "POST", body: form });
    }

    it("stores a valid photo as the account's avatar", async () => {
        saveImageMock.mockResolvedValue({ ok: true, url: "/uploads/2026-11-02/me.jpg" });
        const response = await uploadAvatar(upload(), {});
        expect(response.status).toBe(200);
        expect(updateOneMock).toHaveBeenCalledWith({ _id: "u1" }, { $set: { avatar: "/uploads/2026-11-02/me.jpg" } });
    });

    it("refuses an invalid image", async () => {
        saveImageMock.mockResolvedValue({ ok: false, message: "Unsupported file type" });
        expect((await uploadAvatar(upload(), {})).status).toBe(400);
        expect(updateOneMock).not.toHaveBeenCalled();
    });

    it("removes the photo and its file, which stops it being served", async () => {
        previousAvatar = "/uploads/2026-11-02/old.jpg";
        await removeAvatar(new NextRequest("http://localhost/api/account/avatar", { method: "DELETE" }), {});
        expect(updateOneMock).toHaveBeenCalledWith({ _id: "u1" }, { $set: { avatar: "" } });
        expect(removeUploadMock).toHaveBeenCalledWith("/uploads/2026-11-02/old.jpg");
        previousAvatar = "";
    });

    it("saves profile fields over an old plain-string profile", async () => {
        await PATCH(jsonRequest("PATCH", { bio: "Hello" }), {});
        expect(updateOneMock).toHaveBeenCalledWith({ _id: "u1", profile: { $type: "string" } }, { $unset: { profile: "", intro: "", mobile: "" } });
    });
});
