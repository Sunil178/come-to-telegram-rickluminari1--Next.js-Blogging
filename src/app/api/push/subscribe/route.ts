import { NextResponse } from "next/server";
import PushSubscription from "@/models/PushSubscription";
import { withApiGuard } from "@/libs/api-guard";
import { isAllowedPushEndpoint } from "@/libs/push-endpoint";
import { logger } from "@/libs/logger";

const MAX_KEY_LENGTH = 256;
// Bounds the fan-out of every notify() call; the oldest devices are evicted first.
const MAX_SUBSCRIPTIONS_PER_USER = 10;
const LAST_SEEN_REFRESH_MS = 24 * 60 * 60 * 1000;

export const POST = withApiGuard(
    async (request, { session }) => {
        try {
            const body = await request.json().catch(() => null);
            const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
            const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
            const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
            if (
                !endpoint ||
                !p256dh ||
                !auth ||
                p256dh.length > MAX_KEY_LENGTH ||
                auth.length > MAX_KEY_LENGTH ||
                !isAllowedPushEndpoint(endpoint)
            ) {
                return NextResponse.json({ data: null, message: "Invalid subscription" }, { status: 400 });
            }

            // The bell re-syncs on every page load; an unchanged binding needs no write or cap query.
            const existing = await PushSubscription.findOne({ endpoint }).select("userId keys updatedAt").lean<{
                _id: unknown;
                userId: unknown;
                keys?: { p256dh?: string; auth?: string };
                updatedAt?: Date;
            }>();
            if (existing && String(existing.userId) === session.user.id && existing.keys?.p256dh === p256dh && existing.keys?.auth === auth) {
                // updatedAt doubles as "last seen" for the cap's eviction order; refreshed at most daily.
                if (!existing.updatedAt || Date.now() - existing.updatedAt.getTime() > LAST_SEEN_REFRESH_MS) {
                    await PushSubscription.updateOne({ _id: existing._id }, { $set: { updatedAt: new Date() } });
                }
                return NextResponse.json({ data: null, message: "Success" });
            }

            const upsert = () =>
                PushSubscription.updateOne(
                    { endpoint },
                    { userId: session.user.id, endpoint, keys: { p256dh, auth } },
                    { upsert: true }
                );
            try {
                await upsert();
            } catch (error) {
                // Two concurrent upserts of a new endpoint race on the unique index; the loser's retry updates instead.
                if ((error as { code?: number }).code !== 11000) throw error;
                await upsert();
            }

            const overflow = await PushSubscription.find({ userId: session.user.id })
                .sort({ updatedAt: -1 })
                .skip(MAX_SUBSCRIPTIONS_PER_USER)
                .select("_id")
                .lean();
            if (overflow.length > 0) {
                await PushSubscription.deleteMany({ _id: { $in: overflow.map((sub: { _id: unknown }) => sub._id) } });
            }

            return NextResponse.json({ data: null, message: "Success" });
        } catch (error) {
            logger.error("Failed to save push subscription", { error });
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { rateLimit: { points: 30, duration: 60 } }
);
