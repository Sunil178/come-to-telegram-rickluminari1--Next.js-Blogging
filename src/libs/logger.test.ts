import { afterEach, describe, expect, it, vi } from "vitest";

async function loadLogger(env: Record<string, string>) {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    return (await import("@/libs/logger")).logger;
}

describe("logger", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("writes one JSON line per entry in production, with level, time, message and fields", async () => {
        const write = vi.spyOn(console, "info").mockImplementation(() => {});
        const logger = await loadLogger({ NODE_ENV: "production" });

        logger.info("Post published", { slug: "hello" });

        const entry = JSON.parse(write.mock.calls[0][0]);
        expect(entry).toMatchObject({ level: "info", msg: "Post published", slug: "hello" });
        expect(new Date(entry.time).toString()).not.toBe("Invalid Date");
    });

    it("serializes errors with name, message and stack", async () => {
        const write = vi.spyOn(console, "error").mockImplementation(() => {});
        const logger = await loadLogger({ NODE_ENV: "production" });

        logger.error("Failed to save", { error: Object.assign(new Error("boom"), { code: 11000 }) });

        const entry = JSON.parse(write.mock.calls[0][0]);
        expect(entry.error).toMatchObject({ name: "Error", message: "boom", code: 11000 });
        expect(entry.error.stack).toContain("boom");
    });

    it("drops entries below LOG_LEVEL", async () => {
        const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const logger = await loadLogger({ NODE_ENV: "production", LOG_LEVEL: "warn" });

        logger.debug("noise");
        logger.warn("kept");

        expect(debug).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
    });

    it("never throws on circular or BigInt fields", async () => {
        const write = vi.spyOn(console, "error").mockImplementation(() => {});
        const logger = await loadLogger({ NODE_ENV: "production" });
        const circular: Record<string, unknown> = { id: BigInt(1) };
        circular.self = circular;

        expect(() => logger.error("Odd payload", { circular })).not.toThrow();
        expect(JSON.parse(write.mock.calls[0][0]).circular).toEqual({ id: "1", self: "[Circular]" });
    });

    it("keeps the cause chain and nested errors", async () => {
        const write = vi.spyOn(console, "error").mockImplementation(() => {});
        const logger = await loadLogger({ NODE_ENV: "production" });
        const error = Object.assign(new Error("cast failed", { cause: new Error("socket closed") }), { reason: new Error("bad id") });

        logger.error("Query failed", { error });

        const logged = JSON.parse(write.mock.calls[0][0]).error;
        expect(logged.cause.message).toBe("socket closed");
        expect(logged.reason.message).toBe("bad id");
    });
});
