"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ROLE_LABELS, ROLES, type RoleName } from "@/libs/roles";

const ROLE_OPTIONS: RoleName[] = [ROLES.READER, ROLES.AUTHOR, ROLES.MODERATOR, ROLES.ADMIN];

const ROLE_ABILITIES: Record<RoleName, string> = {
    reader: "They can read, comment, vote and ask to publish, but not write posts.",
    author: "They can write posts, which a moderator reviews before they go live.",
    moderator: "They can approve or reject everyone's posts and remove comments.",
    admin: "They get full control: users and roles, publish requests, categories and uploads.",
};

interface RoleSelectProps {
    userId: string;
    username: string;
    currentRole: RoleName;
    disabled?: boolean;
}

export default function RoleSelect({ userId, username, currentRole, disabled }: RoleSelectProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    // The role picked in the menu, waiting for the admin to confirm it.
    const [proposed, setProposed] = useState<RoleName | null>(null);

    const setRole = (role: RoleName) => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/users/role/${userId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role }),
                });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to update role.");
                    return;
                }
                toast.success(`Role updated to ${ROLE_LABELS[role as RoleName]}.`);
                router.refresh();
            } catch {
                toast.error("Failed to update role.");
            }
        });
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={disabled || pending}>
                        {ROLE_LABELS[currentRole]} <ChevronDown className="size-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup value={currentRole} onValueChange={(role) => role !== currentRole && setProposed(role as RoleName)}>
                        {ROLE_OPTIONS.map((role) => (
                            <DropdownMenuRadioItem key={role} value={role}>
                                {ROLE_LABELS[role]}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog open={proposed !== null} onOpenChange={(open) => !open && setProposed(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Change {username}&apos;s role from {ROLE_LABELS[currentRole]} to {proposed && ROLE_LABELS[proposed]}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>{proposed && ROLE_ABILITIES[proposed]} It takes effect within a minute.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (proposed) setRole(proposed);
                                setProposed(null);
                            }}
                        >
                            Change role
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
