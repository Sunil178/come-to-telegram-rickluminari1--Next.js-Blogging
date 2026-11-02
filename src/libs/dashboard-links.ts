// The signed-in user's own pages, shared by the dashboard menu and the avatar menu so the two stay in step.
export const PERSONAL_DASHBOARD_LINKS = [
    { href: "/dashboard/posts", label: "My Posts" },
    { href: "/dashboard/notifications", label: "Notifications" },
    { href: "/dashboard/account", label: "Account" },
] as const;
