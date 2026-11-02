import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import PublishRequestActions from "@/components/dashboard/admin/PublishRequestActions";
import { loadApplicant } from "@/libs/applicant";
import { formatLocation, type IpRecord } from "@/libs/geoip";
import { ageOn, profileLinks } from "@/libs/profile";

export const metadata = { title: "Review request to publish" };

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const formatDate = (date: Date | null | undefined) => (date ? `${dateFormat.format(new Date(date))} UTC` : "—");

function daysSince(date: Date, now: Date): number {
    return Math.floor((now.getTime() - new Date(date).getTime()) / 86_400_000);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl p-5 ring-1 ring-border" aria-label={title}>
            <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
            <div className="mt-3">{children}</div>
        </section>
    );
}

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
    return (
        <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2 text-sm">
            {rows.map(([label, value]) => (
                <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words text-foreground">{value || "—"}</dd>
                </div>
            ))}
        </dl>
    );
}

function Address({ record }: { record: IpRecord | null }) {
    if (!record) return <>Not recorded</>;
    return (
        <>
            <span className="font-mono">{record.ip}</span> · {formatLocation(record.location)} · {formatDate(record.at)}
        </>
    );
}

export default async function ReviewRequestPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!isValidObjectId(id)) notFound();
    const applicant = await loadApplicant(id);
    if (!applicant) notFound();
    const { request, user, activity } = applicant;
    const now = new Date();
    const details = user.privateDetails;
    const profile = user.profile;

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
                            <Link href={`/users/${encodeURIComponent(user.username)}`} className="text-primary hover:underline">@{user.username}</Link> · {user.email}
                        </p>
                    </div>
                </div>
                {request.status === "Pending" ? (
                    <PublishRequestActions id={request.id} />
                ) : (
                    <Badge variant="secondary">
                        {request.status} {formatDate(request.reviewedAt)}
                    </Badge>
                )}
            </div>

            <Section title="Application">
                <Facts rows={[["Requested", formatDate(request.createdAt)], ["Requested from", <Address key="from" record={request.requestedFrom} />]]} />
                <h3 className="mt-4 text-sm font-medium text-foreground">Why they want to write</h3>
                <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">{request.motivation || "Not given (request made before the application form existed)."}</p>
                <h3 className="mt-4 text-sm font-medium text-foreground">Writing sample</h3>
                <p className="mt-1 max-h-96 overflow-y-auto rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap text-foreground">{request.writingSample || "Not given."}</p>
            </Section>

            <Section title="Account and activity">
                <Facts
                    rows={[
                        ["Role", user.role],
                        ["Joined", `${formatDate(user.createdAt)} (${daysSince(user.createdAt, now)} days ago)`],
                        ["Email", user.emailVerifiedAt === null ? "Not verified" : user.emailVerifiedAt ? `Verified ${formatDate(user.emailVerifiedAt)}` : "Verified (before verification existed)"],
                        ["Comments", `${activity.comments} (${activity.commentUpvotes} upvotes, ${activity.commentDownvotes} downvotes received)`],
                        ["Votes cast", String(activity.votesCast)],
                        ["Profile score", String(user.profileScore)],
                        ["Earlier requests", activity.earlierRequests.length ? activity.earlierRequests.map((r) => `${r.status} (${formatDate(r.createdAt)})`).join(", ") : "None"],
                    ]}
                />
            </Section>

            <Section title="Addresses">
                <Facts rows={[["Signed up from", <Address key="signup" record={user.signup} />], ["Last signed in from", <Address key="login" record={user.lastLogin} />]]} />
                <p className="mt-3 text-xs text-muted-foreground">Locations are approximate (city level at best) and can reflect a VPN or mobile network.</p>
            </Section>

            <Section title="Public profile">
                <Facts
                    rows={[
                        ["Headline", profile.headline],
                        ["Bio", profile.bio && <span className="whitespace-pre-wrap">{profile.bio}</span>],
                        ["Location", [profile.city, profile.country].filter(Boolean).join(", ")],
                        ["Expertise", profile.expertise?.join(", ")],
                        ["Topics", profile.topics?.join(", ")],
                        ["Education", profile.education],
                        [
                            "Links",
                            profileLinks(profile).length > 0 && (
                                <ul>
                                    {profileLinks(profile).map((link) => (
                                        <li key={link}>
                                            <a href={link} rel="ugc nofollow noopener noreferrer" target="_blank" className="text-primary hover:underline">{link}</a>
                                        </li>
                                    ))}
                                </ul>
                            ),
                        ],
                    ]}
                />
            </Section>

            <Section title="Private details">
                <Facts
                    rows={[
                        ["Age", details.dateOfBirth ? `${ageOn(new Date(details.dateOfBirth), now)} (born ${new Date(details.dateOfBirth).toISOString().slice(0, 10)})` : null],
                        ["Gender", details.gender],
                        ["Phone", details.phone],
                        ["Address", details.address && <span className="whitespace-pre-wrap">{details.address}</span>],
                    ]}
                />
            </Section>
        </div>
    );
}
