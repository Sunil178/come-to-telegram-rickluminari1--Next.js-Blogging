"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface DashboardNavGroup {
    label: string;
    links: { href: string; label: string }[];
}

export default function DashboardNav({ groups }: { groups: DashboardNavGroup[] }) {
    const pathname = usePathname();
    // Longest match wins, so a nested page highlights its own tab and not a shorter prefix.
    const active = groups
        .flatMap((group) => group.links)
        .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href;

    return (
        <nav aria-label="Dashboard" className="border-b border-border bg-card">
            {/* Each group is its own row on a phone and set off by a divider on wider screens; names are for screen readers. */}
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-y-2 px-6 py-3">
                {groups.map((group, index) => (
                    <div
                        key={group.label}
                        role="group"
                        aria-label={group.label}
                        className={cn(
                            "flex w-full min-w-0 flex-wrap items-center gap-1 sm:w-auto",
                            index > 0 && "border-t border-border pt-2 sm:ml-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-3"
                        )}
                    >
                        {group.links.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                aria-current={link.href === active ? "page" : undefined}
                                className={cn(
                                    "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-accent hover:text-foreground",
                                    link.href === active && "bg-accent text-foreground"
                                )}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                ))}
            </div>
        </nav>
    );
}
