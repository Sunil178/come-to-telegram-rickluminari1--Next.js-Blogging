import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PostsPaginationProps {
    page: number;
    totalPages: number;
    buildHref: (overrides: { page: number }) => string;
    className?: string;
    labelClassName?: string;
}

export default function PostsPagination({
    page,
    totalPages,
    buildHref,
    className,
    labelClassName,
}: PostsPaginationProps) {
    if (totalPages <= 1) return null;

    return (
        <div className={cn("flex items-center justify-center gap-2", className)}>
            <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? <Link href={buildHref({ page: page - 1 })}>Previous</Link> : <span>Previous</span>}
            </Button>
            <span className={cn("px-3 text-sm text-muted-foreground", labelClassName)}>
                Page {page} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
                {page < totalPages ? <Link href={buildHref({ page: page + 1 })}>Next</Link> : <span>Next</span>}
            </Button>
        </div>
    );
}
