import { Skeleton } from "@/components/ui/skeleton";
import ArticleCardSkeleton from "@/components/posts/ArticleCardSkeleton";

export default function Loading() {
    return (
        <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="flex flex-col items-center text-center">
                <Skeleton className="size-20 rounded-full" />
                <Skeleton className="mt-4 h-9 w-48" />
                <Skeleton className="mt-3 h-4 w-64" />
            </div>

            <div className="mt-14">
                <Skeleton className="h-7 w-40" />
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <ArticleCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        </div>
    );
}
