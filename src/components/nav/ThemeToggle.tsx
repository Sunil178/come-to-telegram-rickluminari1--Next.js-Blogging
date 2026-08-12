"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
] as const;

function noopSubscribe() {
    return () => {};
}

// Reads as "true" only once client rendering has taken over, without the
// setState-in-effect pattern this repo's lint config forbids.
function useMounted() {
    return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const mounted = useMounted();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Toggle theme" className="relative shrink-0">
                    {mounted && theme === "system" ? (
                        <Monitor />
                    ) : (
                        <>
                            <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                            <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                    {OPTIONS.map(({ value, label, icon: Icon }) => (
                        <DropdownMenuRadioItem key={value} value={value} className="gap-2">
                            <Icon className="size-4" />
                            {label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
