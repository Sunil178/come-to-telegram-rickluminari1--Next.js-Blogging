import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import RoleSelect from "@/components/dashboard/admin/RoleSelect";
import UserDossierView from "@/components/dashboard/admin/UserDossierView";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { loadUserDossier } from "@/libs/applicant";

interface UserDetailsPageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: UserDetailsPageProps): Promise<Metadata> {
    const { id } = await params;
    const dossier = isValidObjectId(id) ? await loadUserDossier(id) : null;
    return { title: dossier ? `${dossier.user.username} — Users` : "User not found" };
}

export default async function UserDetailsPage({ params }: UserDetailsPageProps) {
    const { id } = await params;
    if (!isValidObjectId(id)) notFound();
    const dossier = await loadUserDossier(id);
    if (!dossier) notFound();
    const session = (await getSession()) as AuthenticatedSession;
    const { user } = dossier;

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
            <Link href="/dashboard/admin/users" className="text-sm text-primary hover:underline">← All users</Link>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Avatar size="lg" className="size-16">
                        <AvatarImage src={user.avatar || undefined} alt={user.username} />
                        <AvatarFallback className="text-xl">{user.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">{user.name || user.username}</h1>
                        <p className="text-sm text-muted-foreground">
                            @{user.username} · <Link href={`/users/${encodeURIComponent(user.username)}`} className="text-primary hover:underline">Public profile</Link>
                        </p>
                    </div>
                </div>
                <RoleSelect userId={user.id} username={user.username} currentRole={user.role} disabled={user.id === session.user.id} />
            </div>

            <UserDossierView dossier={dossier} />
        </div>
    );
}
