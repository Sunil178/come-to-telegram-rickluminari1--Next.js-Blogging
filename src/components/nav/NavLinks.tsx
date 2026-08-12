"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "motion/react";
import Flourish from "@/components/marginalia/Flourish";
import { cn } from "@/lib/utils";

interface NavLinksProps {
    links: { href: string; label: string }[];
    className?: string;
    linkClassName?: string;
}

export default function NavLinks({ links, className, linkClassName }: NavLinksProps) {
    const pathname = usePathname();

    return (
        <div className={className}>
            {links.map((link) => {
                const active = pathname === link.href;
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            "relative font-mono text-xs tracking-widest uppercase transition-colors hover:text-foreground",
                            active ? "text-foreground" : "text-muted-foreground",
                            linkClassName
                        )}
                    >
                        {link.label}
                        <AnimatePresence>
                            {active && <Flourish className="absolute inset-x-0 -bottom-2" color="primary" />}
                        </AnimatePresence>
                    </Link>
                );
            })}
        </div>
    );
}
