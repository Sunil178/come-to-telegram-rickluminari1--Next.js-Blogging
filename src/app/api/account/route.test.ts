import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findUserMock = vi.fn();
vi.mock("@/models/User", () => ({ default: { findById: () => ({ select: () => ({ lean: findUserMock }) }) } }));
vi.mock("bcrypt", () => ({ compare: async (plain: string, hashed: string) => hashed === `hash:${plain}` }));

const deleteAccountMock = vi.fn();
const isLastAdminMock = vi.fn();
const exportMock = vi.fn();
vi.mock("@/libs/account-data", () => ({
    deleteAccount: (...args: unknown[]) => deleteAccountMock(...args),
    isLastAdmin: (...args: unknown[]) => isLastAdminMock(...args),
    exportAccountData: (...args: unknown[]) => exportMock(...args),
}));

const { DELETE } = await import("@/app/api/account/route");
const { GET } = await import("@/app/api/account/export/route");

let ip = 0;
function deleteRequest(body: unknown) {
    ip += 1;
    return new NextRequest("http://localhost/api/account", {
        method: "DELETE",
        body: JSON.stringify(body),
        headers: { "x-forwarded-for": `10.1.0.${ip}` },
    });
}

describe("DELETE /api/account", () => {
    beforeEach(() => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "author" } });
        findUserMock.mockReset().mockResolvedValue({ password: "hash:right-password", role: "author" });
        deleteAccountMock.mockReset().mockResolvedValue(undefined);
        isLastAdminMock.mockReset().mockResolvedValue(false);
    });

    it("refuses without the right password and deletes nothing", async () => {
        expect((await DELETE(deleteRequest({ password: "wrong" }), {})).status).toBe(403);
        expect((await DELETE(deleteRequest({}), {})).status).toBe(403);
        expect(deleteAccountMock).not.toHaveBeenCalled();
    });

    it("keeps the last admin", async () => {
        isLastAdminMock.mockResolvedValue(true);
        expect((await DELETE(deleteRequest({ password: "right-password" }), {})).status).toBe(409);
        expect(deleteAccountMock).not.toHaveBeenCalled();
    });

    it("deletes the signed-in account", async () => {
        const response = await DELETE(deleteRequest({ password: "right-password" }), {});
        expect(response.status).toBe(200);
        expect(deleteAccountMock).toHaveBeenCalledWith("u1");
    });

    it("doesn't let the last two admins delete each other at the same moment", async () => {
        let admins = 2;
        findUserMock.mockResolvedValue({ password: "hash:right-password", role: "admin" });
        isLastAdminMock.mockImplementation(async () => admins <= 1);
        deleteAccountMock.mockImplementation(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            admins -= 1;
        });
        authMock.mockResolvedValueOnce({ user: { id: "a1", role: "admin" } }).mockResolvedValueOnce({ user: { id: "a2", role: "admin" } });

        const statuses = (await Promise.all([DELETE(deleteRequest({ password: "right-password" }), {}), DELETE(deleteRequest({ password: "right-password" }), {})])).map((r) => r.status);
        expect(statuses.sort()).toEqual([200, 409]);
        expect(admins).toBe(1);
    });

    it("requires a session", async () => {
        authMock.mockResolvedValue(null);
        expect((await DELETE(deleteRequest({ password: "right-password" }), {})).status).toBe(401);
    });
});

describe("GET /api/account/export", () => {
    it("downloads the signed-in user's data as an uncached JSON attachment", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        exportMock.mockResolvedValue({ profile: { username: "reader" } });
        const response = await GET(new NextRequest("http://localhost/api/account/export", { headers: { "x-forwarded-for": "10.2.0.1" } }), {});

        expect(exportMock).toHaveBeenCalledWith("u1");
        expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="vedev-account-\d{4}-\d{2}-\d{2}\.json"$/);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toEqual({ profile: { username: "reader" } });
    });
});
