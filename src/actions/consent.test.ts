import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
const setMock = vi.fn((name: string, value: string) => jar.set(name, value));
const deleteMock = vi.fn((name: string) => jar.delete(name));
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined),
        set: setMock,
        delete: deleteMock,
    }),
}));
const forgetMock = vi.fn();
vi.mock("@/libs/visitor-events", () => ({ forgetVisitor: (...args: unknown[]) => forgetMock(...args) }));

const { setConsentAction } = await import("@/actions/consent");

const VID = "0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10";

describe("setConsentAction", () => {
    beforeEach(() => {
        jar.clear();
        setMock.mockClear();
        deleteMock.mockClear();
        forgetMock.mockReset();
    });

    it("issues an httpOnly random visitor id when consent is granted", async () => {
        await setConsentAction("granted");
        expect(jar.get("consent")).toBe("granted");
        expect(jar.get("vid")).toMatch(/^[0-9a-f-]{36}$/);
        expect(setMock).toHaveBeenCalledWith("vid", expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: "lax" }));
    });

    it("keeps an existing visitor id when consent is granted again", async () => {
        jar.set("vid", VID);
        await setConsentAction("granted");
        expect(jar.get("vid")).toBe(VID);
    });

    it("deletes the visitor id and its anonymous events when consent is withdrawn", async () => {
        jar.set("consent", "granted");
        jar.set("vid", VID);
        await setConsentAction("denied");
        expect(forgetMock).toHaveBeenCalledWith(VID);
        expect(jar.has("vid")).toBe(false);
        expect(jar.get("consent")).toBe("denied");
    });

    it("ignores anything but the two choices", async () => {
        await setConsentAction("sure" as never);
        expect(setMock).not.toHaveBeenCalled();
    });
});
