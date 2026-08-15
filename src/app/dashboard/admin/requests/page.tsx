import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PublishRequestActions from "@/components/dashboard/admin/PublishRequestActions";

export default async function AdminRequestsPage() {
    const requests = await PublishRequest.find({ status: "Pending" })
        .populate({ path: "userId", model: User, select: "email username" })
        .sort({ createdAt: 1 })
        .lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Publish Requests</h1>
            <p className="mt-2 text-muted-foreground">Readers asking to become Authors.</p>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>User</TableHead>
                            <TableHead>Requested</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((req) => {
                            const requester = req.userId as unknown as { email?: string; username?: string } | null;
                            return (
                                <TableRow key={String(req._id)}>
                                    <TableCell>{requester?.email || requester?.username || "—"}</TableCell>
                                    <TableCell className="font-mono text-xs">{new Date(req.createdAt).toLocaleDateString("en-US")}</TableCell>
                                    <TableCell className="text-right">
                                        <PublishRequestActions id={String(req._id)} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {requests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                    No pending requests.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
