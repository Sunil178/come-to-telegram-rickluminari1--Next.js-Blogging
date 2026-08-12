import { cn } from "@/lib/utils";

export default function Wordmark({ className }: { className?: string }) {
    return (
        <span className={cn("font-heading text-2xl font-semibold tracking-tight text-foreground", className)}>
            Vedev<span className="text-primary">.</span>Guru
        </span>
    );
}
