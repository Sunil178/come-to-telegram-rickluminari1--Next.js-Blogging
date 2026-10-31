// Passed in the registration URL by registerServiceWorker() -- a static file can't read env vars.
const VAPID_PUBLIC_KEY = new URL(self.location.href).searchParams.get("vapidKey") || "";

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

function postJson(url, body) {
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

// Take control of already-open tabs right away, so the tab that just enabled push
// receives bell-refresh messages and can be focused without a reload first.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
    if (!event.data) return;
    let data;
    try {
        data = event.data.json();
    } catch {
        // e.g. a DevTools "Push" test message, which is plain text.
        data = { title: "Vedev.Guru", body: event.data.text() };
    }
    event.waitUntil(
        self.registration
            .showNotification(data.title || "Vedev.Guru", { body: data.body, icon: "/icons/icon-192.png", data: { url: data.url, notificationId: data.notificationId } })
            .then(() =>
                self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
                    clients.forEach((client) => client.postMessage({ type: "notification-received" }));
                })
            )
    );
});

// Chrome subscriptions don't expire so this never fires there, but Firefox rotates
// endpoints and expects the SW to resubscribe here, per MDN's documented pattern.
self.addEventListener("pushsubscriptionchange", (event) => {
    const oldEndpoint = event.oldSubscription?.endpoint;
    // Firefox often passes no oldSubscription, so the VAPID key can't come from its options.
    const subscribeOptions = event.oldSubscription?.options || {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    };

    event.waitUntil(
        self.registration.pushManager
            .subscribe(subscribeOptions)
            .then((subscription) =>
                postJson("/api/push/subscribe", subscription.toJSON()).then((response) => {
                    if (!response.ok) throw new Error(`Saving the new subscription failed (${response.status})`);
                    if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
                        return postJson("/api/push/unsubscribe", { endpoint: oldEndpoint });
                    }
                })
            )
            .catch((error) => console.error("Failed to handle pushsubscriptionchange:", error))
    );
});

// Only same-origin targets, so a notification can never open an arbitrary site.
function resolveTarget(url) {
    const target = new URL(url || "/", self.location.origin);
    return target.origin === self.location.origin ? target : new URL("/", self.location.origin);
}

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = resolveTarget(event.notification.data?.url);
    const notificationId = event.notification.data?.notificationId;

    // Focus/open first: browsers only allow it briefly after the click, so it can't wait on the PATCH.
    const openTarget = self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        const samePage = clients.find((c) => new URL(c.url).pathname === target.pathname);
        if (samePage) {
            // The page reloads itself (see NotificationBell) so the new comment is in its tree.
            return samePage.focus().then((client) => client.postMessage({ type: "open-notification", url: target.href }));
        }
        return self.clients.openWindow(target.href);
    });

    const markRead = notificationId
        ? fetch(`/api/notifications/${notificationId}/read`, { method: "PATCH" }).catch(() => {})
        : Promise.resolve();

    event.waitUntil(
        Promise.all([openTarget, markRead]).then(() =>
            self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
                clients.forEach((client) => client.postMessage({ type: "notification-received" }));
            })
        )
    );
});
