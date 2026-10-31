import webpush from "web-push";
import Notification, { type NotificationType } from "@/models/Notification";
import PushSubscription from "@/models/PushSubscription";
import User from "@/models/User";
import {
    categoryOf,
    DEDUPED_NOTIFICATION_TYPES,
    describeNotification,
    NOTIFICATION_TITLES,
    notificationLink,
    resolvePreferences,
    type ChannelPreference,
} from "@/libs/notification-types";
import { isAllowedPushEndpoint } from "@/libs/push-endpoint";
import { logger } from "@/libs/logger";
import { vapidPublicKey } from "@/libs/runtime-config";

// Missing or malformed VAPID keys (e.g. .env.example placeholders) degrade the feature
// to in-app-only notifications instead of failing every route that imports this module.
function configurePush(): boolean {
    const publicKey = vapidPublicKey();
    if (!process.env.VAPID_PRIVATE_KEY || !publicKey) return false;
    try {
        webpush.setVapidDetails(
            process.env.VAPID_CONTACT_EMAIL || "mailto:noreply@example.com",
            publicKey,
            process.env.VAPID_PRIVATE_KEY
        );
        return true;
    } catch (error) {
        logger.error("Invalid VAPID configuration, push notifications disabled", { error });
        return false;
    }
}
const pushConfigured = configurePush();

// The key clients subscribe with, or "" when the server can't send push (so the UI doesn't offer it).
export function pushPublicKey(): string {
    return pushConfigured ? vapidPublicKey() : "";
}

// Push text and links come from the shared catalogue, so they always match the bell and the page.
interface NotifyOptions {
    recipientId: string;
    actorId?: string | null;
    actorUsername?: string | null;
    type: NotificationType;
    postId?: string | null;
    postTitle?: string | null;
    postSlug?: string | null;
    commentId?: string | null;
}

async function channelsFor(recipientId: string, type: NotificationType): Promise<ChannelPreference | null> {
    try {
        const recipient = await User.findById(recipientId).select("notificationPrefs").lean<{ notificationPrefs?: Record<string, ChannelPreference> }>();
        if (!recipient) return null;
        return resolvePreferences(recipient.notificationPrefs)[categoryOf(type)];
    } catch (error) {
        logger.error("Failed to load notification preferences", { error });
        return { inApp: true, push: true };
    }
}

// Called from after() by its callers, so it must never throw -- the triggering
// request has already responded by the time this runs.
export async function notify(options: NotifyOptions): Promise<void> {
    const { recipientId, actorId = null, actorUsername = null, type, postId = null, postTitle = null, postSlug = null, commentId = null } = options;
    // At most one notification per actor and target (upvotes), so toggling a vote can't re-notify.
    const dedupe = DEDUPED_NOTIFICATION_TYPES.includes(type);

    if (actorId && actorId === recipientId) return;

    const channels = await channelsFor(recipientId, type);
    if (!channels || (!channels.inApp && !channels.push)) return;

    let notificationId: string | undefined;
    try {
        const fields = { recipientId, actorId, type, postId, commentId };
        if (dedupe) {
            // In-app off: keep a hidden record (no readAt, so the read TTL never removes it) so repeats stay silent.
            const visibility = channels.inApp ? {} : { muted: true, read: true };
            const result = await Notification.updateOne(fields, { $setOnInsert: { ...fields, ...visibility, dedupe: true } }, { upsert: true });
            if (!result.upsertedCount) return;
            notificationId = result.upsertedId?.toString();
        } else if (channels.inApp) {
            notificationId = (await Notification.create(fields))._id.toString();
        }
    } catch (error) {
        // Two concurrent upserts for the same key: the unique dedupe index lets only one insert.
        if ((error as { code?: number }).code === 11000) return;
        logger.error("Failed to write notification", { error });
        if (dedupe) return;
    }

    if (!pushConfigured || !channels.push) return;

    let subscriptions;
    try {
        subscriptions = await PushSubscription.find({ userId: recipientId }).lean();
    } catch (error) {
        logger.error("Failed to load push subscriptions", { error });
        return;
    }

    const view = { type, actorUsername, postTitle, postSlug, commentId };
    const payload = JSON.stringify({
        title: NOTIFICATION_TITLES[type],
        body: describeNotification({ ...view, id: "", read: false, createdAt: "" }),
        url: notificationLink(view),
        notificationId: channels.inApp ? notificationId : undefined,
    });

    await Promise.all(
        subscriptions
            // Re-checked at send time so rows stored before the allowlist existed can't be used either.
            .filter((sub) => isAllowedPushEndpoint(sub.endpoint))
            .map(async (sub) => {
                try {
                    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
                } catch (error) {
                    const statusCode = (error as { statusCode?: number }).statusCode;
                    if (statusCode === 404 || statusCode === 410) {
                        await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
                    } else {
                        logger.error("Failed to send push notification", { error });
                    }
                }
            })
    );
}
