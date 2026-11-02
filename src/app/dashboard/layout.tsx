import DashboardNav, { type DashboardNavGroup } from "@/components/dashboard/DashboardNav";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { PERSONAL_DASHBOARD_LINKS } from "@/libs/dashboard-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    // proxy.ts (isGatedPath) redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const role = session.user.role;

    // Ordered by how often each role reaches for it: own work first, then queues that need action, then site settings.
    const groups: DashboardNavGroup[] = [
        {
            label: "You",
            links: [...PERSONAL_DASHBOARD_LINKS],
        },
        {
            label: "Moderation",
            links: hasRole(role, ROLES.MODERATOR)
                ? [
                      { href: "/dashboard/admin/posts", label: "Review Queue" },
                      { href: "/dashboard/admin/comments", label: "Comments" },
                  ]
                : [],
        },
        {
            label: "Admin",
            links: hasRole(role, ROLES.ADMIN)
                ? [
                      { href: "/dashboard/admin/requests", label: "Publish Requests" },
                      { href: "/dashboard/admin/all-posts", label: "All Posts" },
                      { href: "/dashboard/admin/users", label: "Users" },
                      { href: "/dashboard/admin/categories", label: "Categories" },
                      { href: "/dashboard/admin/uploads", label: "Uploads" },
                  ]
                : [],
        },
    ].filter((group) => group.links.length > 0);

    return (
        <div>
            <DashboardNav groups={groups} />
            {children}
        </div>
    );
}
