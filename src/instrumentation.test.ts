import { describe, expect, it, vi } from "vitest";

const errorMock = vi.fn();
vi.mock("@/libs/logger", () => ({ logger: { error: (...args: unknown[]) => errorMock(...args) } }));

const { onRequestError } = await import("@/instrumentation");

describe("onRequestError", () => {
    it("logs the error with its route context and digest, but never the request headers", async () => {
        const error = Object.assign(new Error("render failed"), { digest: "abc123" });

        await onRequestError(
            error,
            { path: "/posts/x?token=querysecret", method: "GET", headers: { cookie: "authjs.session-token=secret" } },
            { routerKind: "App Router", routePath: "/posts/[slug]", routeType: "render", renderSource: "server-rendering", revalidateReason: undefined }
        );

        const [message, fields] = errorMock.mock.calls[0];
        expect(message).toBe("Unhandled request error");
        expect(fields).toMatchObject({ error, digest: "abc123", method: "GET", path: "/posts/x", routePath: "/posts/[slug]", routeType: "render" });
        expect(JSON.stringify(fields)).not.toContain("secret");
    });
});
