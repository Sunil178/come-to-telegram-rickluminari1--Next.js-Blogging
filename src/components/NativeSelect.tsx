import { cn } from "@/lib/utils";

/** A native <select> styled like the Input component, so forms keep one height and look. */
export default function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
    return (
        <select
            className={cn(
                "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 [&_option]:bg-popover [&_option]:text-popover-foreground",
                className
            )}
            {...props}
        />
    );
}
