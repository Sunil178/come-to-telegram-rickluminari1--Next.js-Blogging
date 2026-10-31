import type { Instrumentation } from "next";
import { logger } from "@/libs/logger";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { registerNode } = await import("./instrumentation-node");
        await registerNode();
    }
}

// Every uncaught server error (render, Route Handler, Server Action, proxy) as one structured entry.
// Headers are deliberately left out (session cookies), and so is the query string (search terms, tokens).
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
    const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
    logger.error("Unhandled request error", {
        error,
        digest,
        method: request.method,
        path: request.path.split("?")[0],
        routePath: context.routePath,
        routeType: context.routeType,
        routerKind: context.routerKind,
    });
};
