import Link from "next/link";
import { redirect } from "next/navigation";
import User from "@/models/User";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { countNotifications, listNotifications } from "@/libs/notification-feed";
import { NOTIFICATION_CATEGORY_KEYS, resolvePreferences } from "@/libs/notification-types";
import { pushPublicKey } from "@/libs/notify";
import NotificationList from "@/components/notifications/NotificationList";
import NotificationPreferencesForm from "@/components/notifications/NotificationPreferencesForm";

export const metadata = { title: "Notifications" };

const PAGE_SIZE = 20;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    // proxy.ts (isGatedPath) redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const requested = Math.max(1, Math.floor(Number((await searchParams).page)) || 1);
    const pageCount = Math.max(1, Math.ceil((await countNotifications(session.user.id)) / PAGE_SIZE));
    // Past the end (a stale link, or rows the read TTL removed): go to the last page instead of an empty one.
    if (requested > pageCount) redirect(`/dashboard/notifications?page=${pageCount}`);
    const page = requested;

    const [{ notifications, unreadCount }, user] = await Promise.all([
        listNotifications(session.user.id, { page, limit: PAGE_SIZE }),
        User.findById(session.user.id).select("notificationPrefs").lean<{ notificationPrefs?: Record<string, object> }>(),
    ]);
    // Publish requests reach admins and review requests moderators only; the switches are pointless for anyone else.
    const categories = NOTIFICATION_CATEGORY_KEYS.filter((key) =>
        key === "requests" ? hasRole(session.user.role, ROLES.ADMIN) : key === "reviews" ? hasRole(session.user.role, ROLES.MODERATOR) : true
    );

    return (
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Notifications</h1>
                <div className="mt-6">
                    {/* Keyed by page so client state resets when navigating between pages. */}
                    <NotificationList key={page} initial={notifications} initialUnread={unreadCount} />
                </div>
                {pageCount > 1 && (
                    <nav aria-label="Notification pages" className="mt-4 flex items-center justify-between text-sm">
                        {page > 1 ? <Link href={`?page=${page - 1}`} className="text-primary hover:underline">← Newer</Link> : <span />}
                        <span className="text-muted-foreground">Page {page} of {pageCount}</span>
                        {page < pageCount ? <Link href={`?page=${page + 1}`} className="text-primary hover:underline">Older →</Link> : <span />}
                    </nav>
                )}
            </div>
            <aside>
                <NotificationPreferencesForm
                    initial={resolvePreferences(user?.notificationPrefs)}
                    categories={categories}
                    pushAvailable={Boolean(pushPublicKey())}
                />
            </aside>
        </div>
    );
}
