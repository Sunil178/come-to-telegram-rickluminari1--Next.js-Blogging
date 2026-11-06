import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import PublishRequestActions from "@/components/dashboard/admin/PublishRequestActions";
import UserDossierView, { Address, Facts, formatDate, Section } from "@/components/dashboard/admin/UserDossierView";
import { loadApplicant } from "@/libs/applicant";

export const metadata = { title: "Review request to publish" };

export default async function ReviewRequestPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!isValidObjectId(id)) notFound();
    const applicant = await loadApplicant(id);
    if (!applicant) notFound();
    const { request, user } = applicant;

    return (
        <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
            <Link href="/dashboard/admin/requests" className="text-sm text-primary hover:underline">← All requests</Link>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Avatar size="lg" className="size-16">
                        <AvatarImage src={user.avatar || undefined} alt={user.username} />
                        <AvatarFallback className="text-xl">{user.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">{user.name || user.username}</h1>
                        <p className="text-sm text-muted-foreground">
                            <Link href={`/dashboard/admin/users/${user.id}`} className="text-primary hover:underline">@{user.username}</Link> · {user.email}
                        </p>
                    </div>
                </div>
                {request.status === "Pending" ? (
                    <PublishRequestActions id={request.id} requester={user.username} />
                ) : (
                    <Badge variant="secondary">
                        {request.status} {formatDate(request.reviewedAt)}
                    </Badge>
                )}
            </div>

            <Section title="Application">
                <Facts rows={[["Requested", formatDate(request.createdAt)], ["Requested from", <Address key="from" record={request.requestedFrom} />]]} />
                <h3 className="mt-4 text-sm font-medium text-foreground">Why they want to write</h3>
                <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">{request.motivation || "Not given."}</p>
                <h3 className="mt-4 text-sm font-medium text-foreground">Writing sample</h3>
                <p className="mt-1 max-h-96 overflow-y-auto rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap text-foreground">{request.writingSample || "Not given."}</p>
            </Section>

            <UserDossierView dossier={applicant} excludeRequestId={request.id} />
        </div>
    );
}
