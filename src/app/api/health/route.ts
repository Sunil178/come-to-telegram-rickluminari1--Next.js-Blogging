import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { withApiGuard } from "@/libs/api-guard";

const PING_TIMEOUT_MS = 2000;

async function databaseIsUp(): Promise<boolean> {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("ping timeout")), PING_TIMEOUT_MS);
    });
    try {
        await Promise.race([mongoose.connection.db.admin().ping(), timeout]);
        return true;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

// For container health checks and uptime monitors: 200 when the app can reach MongoDB, 503 otherwise.
export const GET = withApiGuard(
    async () => {
        const up = await databaseIsUp();
        return NextResponse.json(
            { status: up ? "ok" : "error", db: up ? "up" : "down" },
            { status: up ? 200 : 503, headers: { "Cache-Control": "no-store" } }
        );
    },
    { auth: false, rateLimit: { points: 60, duration: 60 } }
);
