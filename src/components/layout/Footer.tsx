import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const FOOTER_LINKS = [
    { href: "/", label: "Home" },
    { href: "/posts", label: "Posts" },
];

export default function Footer() {
    return (
        <footer className="border-t border-border bg-background">
            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
                        Vede<span className="text-primary">.</span>Guru
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Insightful articles, opinions, and the latest in technology.
                    </p>
                </div>
                <nav className="flex items-center gap-6">
                    {FOOTER_LINKS.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
            </div>
            <Separator />
            <p className="px-6 py-4 text-center text-xs text-muted-foreground">
                © {new Date().getFullYear()} Vede.Guru. All rights reserved.
            </p>
        </footer>
    );
}
