import type { TocEntry } from "@/libs/post-content";
import { cn } from "@/lib/utils";

export default function TableOfContents({ toc }: { toc: TocEntry[] }) {
    if (toc.length === 0) return null;

    return (
        <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <p className="font-mono text-[11px] tracking-widest text-gold uppercase">On this page</p>
            <ul className="mt-3 space-y-2 border-l border-border pl-4">
                {toc.map((entry) => (
                    <li key={entry.id} className={cn(entry.level === 3 && "pl-3")}>
                        <a
                            href={`#${entry.id}`}
                            className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {entry.text}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
