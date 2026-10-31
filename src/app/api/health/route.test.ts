import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: vi.fn() }));

const pingMock = vi.fn();
const connection = { readyState: 1, db: { admin: () => ({ ping: () => pingMock() }) } };
vi.mock("mongoose", () => ({ default: { connection } }));

const { GET } = await import("@/app/api/health/route");

const check = () => GET(new NextRequest("http://localhost/api/health"), {});

describe("GET /api/health", () => {
    beforeEach(() => {
        connection.readyState = 1;
        pingMock.mockReset().mockResolvedValue({ ok: 1 });
    });

    it("reports ok without auth when the database answers a ping", async () => {
        const response = await check();

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(await response.json()).toMatchObject({ status: "ok", db: "up" });
    });

    it("returns 503 when the connection isn't open", async () => {
        connection.readyState = 0;
        const response = await check();

        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ status: "error", db: "down" });
    });

    it("returns 503 when the ping fails", async () => {
        pingMock.mockRejectedValue(new Error("timeout"));
        expect((await check()).status).toBe(503);
    });
});
