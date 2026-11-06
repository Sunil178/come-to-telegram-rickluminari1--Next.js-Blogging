import Link from "next/link";
import User from "@/models/User";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RoleSelect from "@/components/dashboard/admin/RoleSelect";
import PostsSearch from "@/components/posts/PostsSearch";
import PostsPagination from "@/components/posts/PostsPagination";
import { ROLES, type RoleName } from "@/libs/roles";
import { escapeRegExp } from "@/libs/search-query";
import { buildSearchParamsHref } from "@/libs/build-href";
import { firstParam, parsePageParam, type SearchParamValue } from "@/libs/search-params";

const PAGE_SIZE = 25;

interface AdminUsersPageProps {
    searchParams: Promise<{ page?: SearchParamValue; q?: SearchParamValue }>;
}

export const metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
    const session = (await getSession()) as AuthenticatedSession;
    const params = await searchParams;
    const q = firstParam(params.q);
    const page = parsePageParam(params.page);
    const pattern = q ? { $regex: escapeRegExp(q), $options: "i" } : null;
    const filter = pattern ? { $or: [{ username: pattern }, { email: pattern }] } : {};
    const [total, users] = await Promise.all([
        User.countDocuments(filter),
        User.find(filter).select("username email role createdAt").sort({ createdAt: 1, _id: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const buildHref = ({ page: next }: { page: number }) => buildSearchParamsHref("/dashboard/admin/users", { q, page: next > 1 ? next : undefined });

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Users</h1>
            <p className="mt-2 text-muted-foreground">
                Manage what every account can do; open one to see all its details. {total} account{total === 1 ? "" : "s"}.
            </p>
            <div className="mt-6">
                <PostsSearch label="Search users" placeholder="Search by username or email..." />
            </div>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>User</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="text-right">Role</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={String(user._id)}>
                                <TableCell>
                                    <Link href={`/dashboard/admin/users/${String(user._id)}`} className="text-primary hover:underline">
                                        {user.username}
                                    </Link>
                                </TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell className="font-mono text-xs">{new Date(user.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</TableCell>
                                <TableCell className="text-right">
                                    <RoleSelect
                                        userId={String(user._id)}
                                        username={user.username}
                                        currentRole={(user.role ?? ROLES.READER) as RoleName}
                                        disabled={String(user._id) === session.user.id}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                        {users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    No users match.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <PostsPagination page={page} totalPages={totalPages} buildHref={buildHref} className="mt-8" />
        </div>
    );
}
