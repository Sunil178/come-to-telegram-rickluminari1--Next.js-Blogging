import { Skeleton } from "@/components/ui/skeleton";

// Neutral heading-and-rows placeholder for pages without a layout-specific skeleton.
export default function PageSkeleton() {
    return (
        <div className="mx-auto max-w-6xl px-6 py-10" aria-busy="true" aria-label="Loading page">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="mt-3 h-4 w-80" />
            <div className="mt-8 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
            </div>
        </div>
    );
}
