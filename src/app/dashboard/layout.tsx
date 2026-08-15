import Link from "next/link";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { hasRole } from "@/libs/roles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    // proxy.ts's matcher redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const role = session.user.role;

    const links = [
        { href: "/dashboard/posts", label: "My Posts", show: true },
        { href: "/dashboard/admin/posts", label: "Review Queue", show: hasRole(role, "moderator") },
        { href: "/dashboard/admin/comments", label: "Comments", show: hasRole(role, "moderator") },
        { href: "/dashboard/admin/requests", label: "Publish Requests", show: hasRole(role, "admin") },
        { href: "/dashboard/admin/users", label: "Users", show: hasRole(role, "admin") },
        { href: "/dashboard/admin/categories", label: "Categories", show: hasRole(role, "admin") },
    ].filter((link) => link.show);

    return (
        <div>
            <nav className="border-b border-border bg-card">
                <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 py-3">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground whitespace-nowrap hover:bg-accent hover:text-foreground"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </nav>
            {children}
        </div>
    );
}
