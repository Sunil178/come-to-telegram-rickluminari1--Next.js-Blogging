import { Skeleton } from "@/components/ui/skeleton";

// Mirrors PostForm's layout: heading, the metadata fields, then the editor.
export default function PostFormSkeleton() {
    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10" aria-busy="true" aria-label="Loading editor">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-9 w-full" />
                </div>
            ))}
            <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-96 w-full rounded-lg" />
            </div>
            <Skeleton className="h-9 w-28 self-end" />
        </div>
    );
}
