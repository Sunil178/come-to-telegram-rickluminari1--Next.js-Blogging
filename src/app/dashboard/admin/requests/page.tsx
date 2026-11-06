import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import PublishRequestActions from "@/components/dashboard/admin/PublishRequestActions";
import { formatLocation, type IpRecord } from "@/libs/geoip";

export const metadata = { title: "Publish Requests" };

export default async function AdminRequestsPage() {
    const requests = await PublishRequest.find({ status: "Pending" })
        .populate({ path: "userId", model: User, select: "email username" })
        .select("userId createdAt requestedFrom")
        .sort({ createdAt: 1 })
        .lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Publish Requests</h1>
            <p className="mt-2 text-muted-foreground">Readers asking to become Authors. Open a request to review the application and profile.</p>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>User</TableHead>
                            <TableHead>Requested</TableHead>
                            <TableHead>From</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((req) => {
                            const requester = req.userId as unknown as { email?: string; username?: string } | null;
                            return (
                                <TableRow key={String(req._id)}>
                                    <TableCell>
                                        <Link href={`/dashboard/admin/requests/${String(req._id)}`} className="text-primary hover:underline">
                                            {requester?.email || requester?.username || "—"}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs">{new Date(req.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</TableCell>
                                    <TableCell className="text-sm">{req.requestedFrom ? formatLocation((req.requestedFrom as IpRecord).location) : "Not recorded"}</TableCell>
                                    <TableCell className="text-right">
                                        <PublishRequestActions id={String(req._id)} requester={requester?.username || requester?.email || "this user"} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {requests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
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
