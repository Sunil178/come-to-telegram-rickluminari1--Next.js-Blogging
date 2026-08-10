"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import LogoutButton from "@/components/auth/LogoutButton";

interface MobileNavProps {
    links: { href: string; label: string }[];
    user: { name?: string | null; email?: string | null } | null;
}

export default function MobileNav({ links, user }: MobileNavProps) {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={open ? "Close menu" : "Open menu"}
                onClick={() => setOpen((prev) => !prev)}
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={open ? "close" : "open"}
                        initial={{ opacity: 0, rotate: -90 }}
                        animate={{ opacity: 1, rotate: 0 }}
                        exit={{ opacity: 0, rotate: 90 }}
                        transition={{ duration: 0.15 }}
                        className="flex"
                    >
                        {open ? <X /> : <Menu />}
                    </motion.span>
                </AnimatePresence>
            </Button>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>
                        Vede<span className="text-primary">.</span>Guru
                    </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4">
                    {links.map((link) => (
                        <SheetClose asChild key={link.href}>
                            <Link
                                href={link.href}
                                className="rounded-md px-2 py-2 text-sm font-medium text-foreground hover:bg-muted"
                            >
                                {link.label}
                            </Link>
                        </SheetClose>
                    ))}
                    {user && (
                        <SheetClose asChild>
                            <Link
                                href="/dashboard"
                                className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-foreground hover:bg-muted"
                            >
                                <LayoutDashboard className="size-4" />
                                Dashboard
                            </Link>
                        </SheetClose>
                    )}
                </nav>
                <Separator />
                <div className="px-4 pb-4">
                    {user ? (
                        <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-foreground">{user.name || "User"}</span>
                            <LogoutButton className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive">
                                <LogOut className="size-4" />
                                Logout
                            </LogoutButton>
                        </div>
                    ) : (
                        <SheetClose asChild>
                            <Button asChild className="w-full">
                                <Link href="/auth/login">Login</Link>
                            </Button>
                        </SheetClose>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
