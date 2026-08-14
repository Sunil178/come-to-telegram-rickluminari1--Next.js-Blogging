import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ArticleCardSkeleton() {
    return (
        <Card className="h-full gap-3 overflow-hidden border-none py-0 shadow-none ring-1 ring-border">
            <Skeleton className="aspect-video w-full rounded-none" />
            <CardHeader className="gap-2 pt-6">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent className="pb-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
                <Skeleton className="mt-4 h-7 w-24" />
            </CardContent>
        </Card>
    );
}
