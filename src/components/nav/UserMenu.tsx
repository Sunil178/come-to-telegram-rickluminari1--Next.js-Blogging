"use client";

import { LogOut } from "lucide-react";
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

interface UserMenuProps {
    name?: string | null;
    email?: string | null;
    image?: string | null;
}

export default function UserMenu({ name, email, image }: UserMenuProps) {
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
