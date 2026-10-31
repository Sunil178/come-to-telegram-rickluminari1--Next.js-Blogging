import { NextResponse } from "next/server";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import { NOTIFICATION_CATEGORY_KEYS, resolvePreferences, type NotificationPreferences } from "@/libs/notification-types";
import { logger } from "@/libs/logger";

export const GET = withApiGuard(async (request, { session }) => {
    try {
        const user = await User.findById(session.user.id).select("notificationPrefs").lean<{ notificationPrefs?: Record<string, object> }>();
        return NextResponse.json({ data: resolvePreferences(user?.notificationPrefs), message: "Success" });
    } catch (error) {
        logger.error("Failed to load notification preferences", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});

// Accepts the full preferences object; unknown categories and non-boolean values are rejected,
// so nothing but { category: { inApp, push } } booleans reaches the stored document.
function parsePreferences(body: unknown): NotificationPreferences | null {
    const input = (body as { preferences?: unknown } | null)?.preferences;
    if (!input || typeof input !== "object" || Array.isArray(input)) return null;
    const entries = Object.entries(input as Record<string, unknown>);
    if (entries.some(([key]) => !NOTIFICATION_CATEGORY_KEYS.includes(key as never))) return null;

    const parsed: Partial<NotificationPreferences> = {};
    for (const key of NOTIFICATION_CATEGORY_KEYS) {
        const value = (input as Record<string, { inApp?: unknown; push?: unknown } | undefined>)[key];
        if (value === undefined) continue;
        if (typeof value !== "object" || typeof value.inApp !== "boolean" || typeof value.push !== "boolean") return null;
        parsed[key] = { inApp: value.inApp, push: value.push };
    }
    return resolvePreferences(parsed);
}

export const PUT = withApiGuard(async (request, { session }) => {
    try {
        const preferences = parsePreferences(await request.json().catch(() => null));
        if (!preferences) {
            return NextResponse.json({ data: null, message: "Invalid preferences" }, { status: 400 });
        }
        await User.updateOne({ _id: session.user.id }, { $set: { notificationPrefs: preferences } });
        return NextResponse.json({ data: preferences, message: "Success" });
    } catch (error) {
        logger.error("Failed to save notification preferences", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
}, { rateLimit: { points: 30, duration: 60 } });
