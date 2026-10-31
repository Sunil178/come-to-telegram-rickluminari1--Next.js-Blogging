"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
    isPushSupported,
    registerServiceWorker,
    subscribeToPush,
    syncExistingSubscription,
    unsubscribeFromPush,
} from "@/libs/push-subscription";

interface NotificationItem {
    id: string;
    type: "comment_reply" | "post_comment" | "post_approved" | "post_rejected";
    read: boolean;
    createdAt: string;
    actorUsername: string | null;
    postTitle: string | null;
    postSlug: string | null;
    commentId: string | null;
}

function describe(n: NotificationItem): string {
    const title = n.postTitle ?? "a post";
    switch (n.type) {
        case "comment_reply":
            return `${n.actorUsername ?? "Someone"} replied to your comment on "${title}"`;
        case "post_comment":
            return `${n.actorUsername ?? "Someone"} commented on your post "${title}"`;
        case "post_approved":
            return `Your post "${title}" was approved`;
        case "post_rejected":
            return `Your post "${title}" was rejected`;
    }
}

// A hash-only change on the current page neither fires hashchange (Next's router uses
// pushState) nor fetches the new comment, so a same-page target gets a full reload instead.
function openSamePageTarget(href: string): boolean {
    if (href === "#") return false;
    const url = new URL(href, window.location.href);
    if (url.pathname !== window.location.pathname) return false;
    window.location.href = url.href;
    window.location.reload();
    return true;
}

function linkFor(n: NotificationItem): string {
    if (!n.postSlug) return "#";
    return n.commentId ? `/posts/${n.postSlug}#comment-${n.commentId}` : `/posts/${n.postSlug}`;
}

// A site can't reopen its own blocked permission prompt, so the best we can do is point
// at the right browser's own settings help page rather than a chrome://-style deep link.
function unblockHelpUrl(): string {
    const ua = navigator.userAgent;
    if (/Firefox/i.test(ua)) return "https://support.mozilla.org/en-US/kb/push-notifications-firefox";
    if (/Edg\//i.test(ua)) return "https://support.microsoft.com/en-us/microsoft-edge/manage-website-notifications-in-microsoft-edge-0c555609-5bf2-479d-a59d-fb30a0b80b2b";
    if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "https://support.apple.com/guide/safari/notifications-ibrw7f78f7fa/mac";
    return "https://support.google.com/chrome/answer/3220216";
}

// The server passes its runtime VAPID public key; without one, the server can't send push, so it isn't offered.
export default function NotificationBell({ vapidPublicKey }: { vapidPublicKey: string }) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [pushSupported] = useState(() => Boolean(vapidPublicKey) && isPushSupported());
    const [pushEnabled, setPushEnabled] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await fetch("/api/notifications");
            if (!response.ok) return;
            const body = await response.json();
            setNotifications(body.data?.notifications ?? []);
            setUnreadCount(body.data?.unreadCount ?? 0);
        } catch {
            // Bell just keeps showing its last-known state.
        }
    }, []);

    // Deferred via .then() rather than called directly -- react-hooks/set-state-in-effect
    // flags a direct call in an effect body to any function that (even asynchronously) sets state.
    useEffect(() => {
        Promise.resolve().then(fetchNotifications);
    }, [fetchNotifications]);

    useEffect(() => {
        if (!pushSupported) return;
        registerServiceWorker(vapidPublicKey)
            .then(() => syncExistingSubscription(vapidPublicKey))
            .then(setPushEnabled)
            .catch(() => {});
    }, [pushSupported, vapidPublicKey]);

    useEffect(() => {
        if (!pushSupported) return;
        const onMessage = (event: MessageEvent) => {
            if (event.data?.type === "notification-received") fetchNotifications();
            if (event.data?.type === "open-notification" && typeof event.data.url === "string") {
                if (!openSamePageTarget(event.data.url)) window.location.assign(event.data.url);
            }
        };
        navigator.serviceWorker.addEventListener("message", onMessage);
        return () => navigator.serviceWorker.removeEventListener("message", onMessage);
    }, [pushSupported, fetchNotifications]);

    function markOneRead(id: string, wasUnread: boolean) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
        // keepalive: a same-page target reloads right after this click.
        fetch(`/api/notifications/${id}/read`, { method: "PATCH", keepalive: true }).catch(() => {});
    }

    async function markAllRead() {
        if (unreadCount === 0) return;
        try {
            const response = await fetch("/api/notifications/read", { method: "PATCH" });
            if (!response.ok) {
                toast.error("Failed to mark notifications read.");
                return;
            }
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch {
            toast.error("Failed to mark notifications read.");
        }
    }

    async function togglePush() {
        try {
            if (pushEnabled) {
                await unsubscribeFromPush();
                setPushEnabled(false);
                toast.success("Push notifications disabled.");
                return;
            }
            if (window.Notification.permission === "denied") {
                toast.error("Notifications are blocked for this site.", {
                    description: "A site can't reopen its own blocked prompt -- allow it from your browser's site settings, then try again.",
                    action: { label: "How to unblock", onClick: () => window.open(unblockHelpUrl(), "_blank", "noopener,noreferrer") },
                });
                return;
            }
            const permission = await window.Notification.requestPermission();
            if (permission !== "granted") return;
            await subscribeToPush(vapidPublicKey);
            setPushEnabled(true);
            toast.success("Push notifications enabled.");
        } catch {
            toast.error("Failed to update push notification settings.");
        }
    }

    return (
        <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
            <DropdownMenuTrigger aria-label="Notifications" className="relative rounded-full p-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
                <Bell className="size-5" />
                {unreadCount > 0 && (
                    <Badge
                        variant="destructive"
                        className="absolute -top-0.5 -right-0.5 h-4 min-w-4 justify-center px-1 text-[10px]"
                    >
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between font-normal">
                    <span className="text-sm font-medium text-foreground">Notifications</span>
                    {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-teal hover:underline">
                            Mark all read
                        </button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                    <p className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
                ) : (
                    <div className="max-h-80 overflow-y-auto">
                        {notifications.map((n) => (
                            <DropdownMenuItem key={n.id} asChild className={n.read ? undefined : "bg-muted/50"}>
                                <Link
                                    href={linkFor(n)}
                                    onClick={(event) => {
                                        markOneRead(n.id, !n.read);
                                        if (openSamePageTarget(linkFor(n))) event.preventDefault();
                                    }}
                                    className="flex flex-col items-start gap-0.5 whitespace-normal"
                                >
                                    <span className="text-sm text-foreground">{describe(n)}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                </Link>
                            </DropdownMenuItem>
                        ))}
                    </div>
                )}
                {pushSupported && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={togglePush}>
                            {pushEnabled ? "Disable push notifications" : "Enable push notifications"}
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
