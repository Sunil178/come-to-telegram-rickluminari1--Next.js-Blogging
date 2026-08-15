import User from "@/models/User";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RoleSelect from "@/components/dashboard/admin/RoleSelect";
import { ROLES, type RoleName } from "@/libs/roles";

export default async function AdminUsersPage() {
    const session = (await getSession()) as AuthenticatedSession;
    const users = await User.find({}).select("username email role").sort({ createdAt: 1 }).lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Users</h1>
            <p className="mt-2 text-muted-foreground">Manage what every account can do.</p>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Role</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={String(user._id)}>
                                <TableCell>{user.email || user.username}</TableCell>
                                <TableCell className="text-right">
                                    <RoleSelect
                                        userId={String(user._id)}
                                        currentRole={(user.role ?? ROLES.READER) as RoleName}
                                        disabled={String(user._id) === session.user.id}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
