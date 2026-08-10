"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
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
                            "relative text-sm font-medium transition-colors hover:text-foreground",
                            active ? "text-foreground" : "text-muted-foreground",
                            linkClassName
                        )}
                    >
                        {link.label}
                        {active && (
                            <motion.span
                                layoutId="navbar-active-link"
                                className="absolute inset-x-0 -bottom-1 h-px bg-foreground"
                                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            />
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
