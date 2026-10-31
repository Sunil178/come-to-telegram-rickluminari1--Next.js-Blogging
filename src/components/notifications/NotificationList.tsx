"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { describeNotification, NOTIFICATIONS_CHANGED, notificationLink, type NotificationView } from "@/libs/notification-types";

export default function NotificationList({ initial, initialUnread }: { initial: NotificationView[]; initialUnread: number }) {
    const [items, setItems] = useState(initial);
    const [unread, setUnread] = useState(initialUnread);

    function markOneRead(item: NotificationView) {
        if (item.read) return;
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
        setUnread((prev) => Math.max(0, prev - 1));
        // keepalive: the click also navigates away.
        fetch(`/api/notifications/${item.id}/read`, { method: "PATCH", keepalive: true })
            .then(() => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED)))
            .catch(() => {});
    }

    async function markAllRead() {
        const response = await fetch("/api/notifications/read", { method: "PATCH" }).catch(() => null);
        if (!response?.ok) {
            toast.error("Failed to mark notifications read.");
            return;
        }
        setItems((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnread(0);
        window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    }

    return (
        <section aria-labelledby="notifications-heading">
            <div className="flex items-center justify-between gap-4">
                <h2 id="notifications-heading" className="font-heading text-xl font-semibold text-foreground">
                    All notifications {unread > 0 && <span className="text-sm font-normal text-muted-foreground">({unread} unread)</span>}
                </h2>
                {unread > 0 && (
                    <Button variant="outline" size="sm" onClick={markAllRead}>
                        Mark all read
                    </Button>
                )}
            </div>
            {items.length === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
                <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
                    {items.map((n) => (
                        <li key={n.id} className={n.read ? undefined : "bg-muted/50"}>
                            <Link href={notificationLink(n)} onClick={() => markOneRead(n)} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-accent">
                                <span className="text-sm text-foreground">
                                    {!n.read && <span className="sr-only">Unread: </span>}
                                    {describeNotification(n)}
                                </span>
                                <time dateTime={n.createdAt} className="shrink-0 text-xs text-muted-foreground">
                                    {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </time>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
