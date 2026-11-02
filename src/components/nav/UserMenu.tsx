"use client";

import Link from "next/link";
import { Bell, FileText, LogOut, PenLine, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LogoutButton from "@/components/auth/LogoutButton";
import { hasRole, ROLES, type RoleName } from "@/libs/roles";
import { PERSONAL_DASHBOARD_LINKS } from "@/libs/dashboard-links";

const ICONS: Record<(typeof PERSONAL_DASHBOARD_LINKS)[number]["href"], typeof FileText> = {
    "/dashboard/posts": FileText,
    "/dashboard/notifications": Bell,
    "/dashboard/account": UserRound,
};

interface UserMenuProps {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: RoleName;
}

export default function UserMenu({ name, email, image, role }: UserMenuProps) {
    const initial = (name ?? email ?? "?").charAt(0).toUpperCase();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Avatar>
                    {image && <AvatarImage src={image} alt={name ?? "Profile"} />}
                    <AvatarFallback>{initial}</AvatarFallback>
                </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
                    <span className="text-sm font-medium text-foreground">{name || "User"}</span>
                    {email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hasRole(role, ROLES.AUTHOR) && (
                    <DropdownMenuItem asChild>
                        <Link href="/posts/add"><PenLine />Write a post</Link>
                    </DropdownMenuItem>
                )}
                {PERSONAL_DASHBOARD_LINKS.map(({ href, label }) => {
                    const Icon = ICONS[href];
                    return (
                        <DropdownMenuItem asChild key={href}>
                            <Link href={href}><Icon />{label}</Link>
                        </DropdownMenuItem>
                    );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild variant="destructive">
                    <LogoutButton className="flex w-full items-center gap-1.5">
                        <LogOut />
                        Logout
                    </LogoutButton>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
