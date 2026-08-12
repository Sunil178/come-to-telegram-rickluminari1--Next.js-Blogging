import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import Wordmark from "@/components/marginalia/Wordmark";

const FOOTER_LINKS = [
    { href: "/", label: "Home" },
    { href: "/posts", label: "Posts" },
];

export default function Footer() {
    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Link href="/">
                        <Wordmark className="text-xl" />
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Essays and notes on technology, culture, and the questions in between.
                    </p>
                </div>
                <nav className="flex items-center gap-6 font-mono text-xs tracking-widest uppercase">
                    {FOOTER_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </div>
            <Separator />
            <p className="px-6 py-4 text-center font-mono text-xs text-muted-foreground">
                © {new Date().getFullYear()} Vedev.Guru. All rights reserved.
            </p>
        </footer>
    );
}
