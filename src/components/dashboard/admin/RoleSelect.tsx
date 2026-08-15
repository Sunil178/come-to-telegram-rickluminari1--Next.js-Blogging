"use client";

import { useTransition } from "react";
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
import { ROLE_LABELS, ROLES, type RoleName } from "@/libs/roles";

const ROLE_OPTIONS: RoleName[] = [ROLES.READER, ROLES.AUTHOR, ROLES.MODERATOR, ROLES.ADMIN];

interface RoleSelectProps {
    userId: string;
    currentRole: RoleName;
    disabled?: boolean;
}

export default function RoleSelect({ userId, currentRole, disabled }: RoleSelectProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const setRole = (role: string) => {
        if (role === currentRole) return;
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={disabled || pending}>
                    {ROLE_LABELS[currentRole]} <ChevronDown className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={currentRole} onValueChange={setRole}>
                    {ROLE_OPTIONS.map((role) => (
                        <DropdownMenuRadioItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
