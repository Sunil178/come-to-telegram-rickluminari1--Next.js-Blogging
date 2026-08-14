import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const COLUMNS = ["Title", "Category", "Author", "Approval", "Published", "Published At", "Visitors", "Votes", "Comments", "Created At", "Actions"];

export default function Loading() {
    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <Skeleton className="h-9 w-56" />
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-9 w-28" />
            </div>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {COLUMNS.map((label) => (
                                <TableHead key={label}>{label}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 8 }).map((_, row) => (
                            <TableRow key={row}>
                                {COLUMNS.map((label) => (
                                    <TableCell key={label}>
                                        <Skeleton className="h-4 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
