import webpush from "web-push";
import Notification, { type NotificationType } from "@/models/Notification";
import PushSubscription from "@/models/PushSubscription";
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

interface NotifyOptions {
    recipientId: string;
    actorId?: string | null;
    type: NotificationType;
    postId: string;
    commentId?: string | null;
    title: string;
    body: string;
    url: string;
}

// Called from after() by its callers, so it must never throw -- the triggering
// request has already responded by the time this runs.
export async function notify(options: NotifyOptions): Promise<void> {
    const { recipientId, actorId = null, type, postId, commentId = null, title, body, url } = options;

    if (actorId && actorId === recipientId) return;

    let createdNotification;
    try {
        createdNotification = await Notification.create({ recipientId, actorId, type, postId, commentId });
    } catch (error) {
        logger.error("Failed to write notification", { error });
    }

    if (!pushConfigured) return;

    let subscriptions;
    try {
        subscriptions = await PushSubscription.find({ userId: recipientId }).lean();
    } catch (error) {
        logger.error("Failed to load push subscriptions", { error });
        return;
    }

    const payload = JSON.stringify({ title, body, url, notificationId: createdNotification?._id?.toString() });

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
