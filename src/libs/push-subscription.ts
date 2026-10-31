// Converts the VAPID public key from URL-safe base64 to the Uint8Array
// applicationServerKey expects -- not something the platform provides itself.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function isCurrentServerKey(key: ArrayBuffer | null, serverKey: string): boolean {
    if (!key) return false;
    const current = urlBase64ToUint8Array(serverKey);
    const existing = new Uint8Array(key);
    return existing.length === current.length && existing.every((byte, i) => byte === current[i]);
}

// Safe to call during initial render (e.g. as a useState lazy initializer), not just
// inside an effect -- guards the SSR pass, where `navigator`/`window` don't exist.
export function isPushSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window
    );
}

// The VAPID key rides along in the script URL so the SW can resubscribe on its own in
// pushsubscriptionchange -- a static file can't read env vars.
export async function registerServiceWorker(serverKey: string): Promise<ServiceWorkerRegistration> {
    const key = encodeURIComponent(serverKey);
    return navigator.serviceWorker.register(`/sw.js?vapidKey=${key}`, { scope: "/", updateViaCache: "none" });
}

// getRegistration(), not serviceWorker.ready -- ready never settles when registration
// failed, which would hang every caller (including logout).
async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    if (!isPushSupported()) return undefined;
    return navigator.serviceWorker.getRegistration("/");
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
    const registration = await getRegistration();
    return registration ? registration.pushManager.getSubscription() : null;
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
    const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) throw new Error("Failed to save push subscription");
}

// Re-binds this browser's subscription to the current user, so a subscription left
// behind by a previous user on a shared browser stops delivering their notifications here.
export async function syncExistingSubscription(serverKey: string): Promise<boolean> {
    const subscription = await getExistingSubscription();
    if (!subscription) return false;
    // Made with a since-rotated VAPID key: the server can't send to it, so replace it while permission still stands.
    if (!isCurrentServerKey(subscription.options.applicationServerKey, serverKey)) {
        await unsubscribeFromPush();
        if (window.Notification.permission !== "granted") return false;
        return subscribeToPush(serverKey).then(
            () => true,
            () => false
        );
    }
    // Best-effort: the browser is still subscribed even if this save is rate-limited or fails.
    await saveSubscription(subscription).catch(() => {});
    return true;
}

export async function subscribeToPush(serverKey: string): Promise<void> {
    if (!(await getRegistration())) throw new Error("Service worker is not registered");
    // Safe to await now that a registration exists; subscribe() needs an active worker.
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(serverKey) as BufferSource,
    });
    await saveSubscription(subscription);
}

export async function unsubscribeFromPush(): Promise<void> {
    const subscription = await getExistingSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
    }).catch(() => {});
}
