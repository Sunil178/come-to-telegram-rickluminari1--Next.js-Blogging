import { describe, expect, it, vi } from "vitest";

const connectMock = vi.fn(async () => ({}));
vi.mock("mongoose", () => ({ default: { connect: connectMock } }));

describe("dbConnect", () => {
    // Sockets opened on demand inside a request keep that request (and every later one) in memory.
    it("opens a fixed-size pool at boot, so no request ever opens a connection", async () => {
        vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:27017/test");
        const { default: dbConnect } = await import("@/libs/db-connect");
        await dbConnect();
        expect(connectMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ minPoolSize: 10, maxPoolSize: 10 }));
    });
});
