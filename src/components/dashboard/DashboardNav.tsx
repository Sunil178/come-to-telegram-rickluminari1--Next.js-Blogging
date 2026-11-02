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
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1 gap-y-2 px-6 py-3">
                {groups.map((group) => (
                    <div key={group.label} role="group" aria-label={group.label} className="mr-3 flex min-w-0 flex-wrap items-center gap-1">
                        {groups.length > 1 && (
                            <span className="mr-1 font-mono text-[10px] tracking-widest whitespace-nowrap text-muted-foreground/70 uppercase">
                                {group.label}
                            </span>
                        )}
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
