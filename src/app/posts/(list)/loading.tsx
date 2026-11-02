import { Skeleton } from "@/components/ui/skeleton";
import ArticleCardSkeleton from "@/components/posts/ArticleCardSkeleton";

export default function Loading() {
    return (
        <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-4 w-56" />
            </div>

            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                <div className="flex gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-5 w-16 rounded-full" />
                    ))}
                </div>
                <Skeleton className="h-9 w-56" />
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                    <ArticleCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
