import webpush from "web-push";
import Notification, { type NotificationType } from "@/models/Notification";
import PushSubscription from "@/models/PushSubscription";
import { isAllowedPushEndpoint } from "@/libs/push-endpoint";

// Missing or malformed VAPID keys (e.g. .env.example placeholders) degrade the feature
// to in-app-only notifications instead of failing every route that imports this module.
function configurePush(): boolean {
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return false;
    try {
        webpush.setVapidDetails(
            process.env.VAPID_CONTACT_EMAIL || "mailto:noreply@example.com",
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        return true;
    } catch (error) {
        console.error("Invalid VAPID configuration, push notifications disabled:", error);
        return false;
    }
}
const pushConfigured = configurePush();

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
        console.error("Failed to write notification:", error);
    }

    if (!pushConfigured) return;

    let subscriptions;
    try {
        subscriptions = await PushSubscription.find({ userId: recipientId }).lean();
    } catch (error) {
        console.error("Failed to load push subscriptions:", error);
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
                        console.error("Failed to send push notification:", error);
                    }
                }
            })
    );
}
