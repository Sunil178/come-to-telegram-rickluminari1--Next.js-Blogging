"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import NavLinks from "@/components/nav/NavLinks";
import UserMenu from "@/components/nav/UserMenu";
import MobileNav from "@/components/nav/MobileNav";

interface NavbarBarProps {
    user: { name?: string | null; email?: string | null; image?: string | null } | null;
}

const BASE_LINKS = [{ href: "/posts", label: "Posts" }];

export default function NavbarBar({ user }: NavbarBarProps) {
    const links = user ? [...BASE_LINKS, { href: "/dashboard", label: "Dashboard" }] : BASE_LINKS;

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
            <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
                <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
                    Vede<span className="text-primary">.</span>Guru
                </Link>

                <NavLinks links={links} className="hidden items-center gap-6 md:flex" />

                <div className="flex items-center gap-3">
                    {user ? (
                        <UserMenu name={user.name} email={user.email} image={user.image} />
                    ) : (
                        <Button asChild size="sm" className="hidden md:inline-flex">
                            <Link href="/auth/login">Login</Link>
                        </Button>
                    )}
                    <MobileNav links={BASE_LINKS} user={user} />
                </div>
            </div>
        </header>
    );
}
