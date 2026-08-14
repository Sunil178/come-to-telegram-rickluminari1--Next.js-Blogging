import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="pb-24">
            <div className="mx-auto max-w-3xl px-6 pt-16 text-center">
                <Skeleton className="mx-auto h-3 w-24" />
                <Skeleton className="mx-auto mt-4 h-11 w-full" />
                <Skeleton className="mx-auto mt-2 h-11 w-3/4" />
                <Skeleton className="mx-auto mt-4 h-4 w-64" />
            </div>

            <div className="mx-auto mt-10 max-w-4xl px-6">
                <Skeleton className="aspect-[21/9] w-full rounded-md" />
            </div>

            <div className="mx-auto mt-14 max-w-3xl space-y-3 px-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        </div>
    );
}
