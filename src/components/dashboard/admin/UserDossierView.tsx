import Link from "next/link";
import { formatLocation, type IpRecord } from "@/libs/geoip";
import { ageOn, profileLinks } from "@/libs/profile";
import { ROLE_LABELS } from "@/libs/roles";
import type { UserDossier } from "@/libs/applicant";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
export const formatDate = (date: Date | null | undefined) => (date ? `${dateFormat.format(new Date(date))} UTC` : "—");

function daysSince(date: Date, now: Date): number {
    return Math.floor((now.getTime() - new Date(date).getTime()) / 86_400_000);
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl p-5 ring-1 ring-border" aria-label={title}>
            <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
            <div className="mt-3">{children}</div>
        </section>
    );
}

export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
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

export function Address({ record }: { record: IpRecord | null }) {
    if (!record) return <>Not recorded</>;
    return (
        <>
            <span className="font-mono">{record.ip}</span> · {formatLocation(record.location)} · {formatDate(record.at)}
        </>
    );
}

/** The admin-only sections about an account, shared by the user details and publish request pages. */
export default function UserDossierView({ dossier, excludeRequestId }: { dossier: UserDossier; excludeRequestId?: string }) {
    const { user, activity } = dossier;
    const now = new Date();
    const details = user.privateDetails;
    const profile = user.profile;
    const requests = activity.requests.filter((request) => request.id !== excludeRequestId);
    const links = profileLinks(profile);

    return (
        <>
            <Section title="Account and activity">
                <Facts
                    rows={[
                        ["Name", user.name],
                        ["Role", ROLE_LABELS[user.role]],
                        ["Joined", `${formatDate(user.createdAt)} (${daysSince(user.createdAt, now)} days ago)`],
                        ["Email", user.emailVerifiedAt ? `${user.email} (verified ${formatDate(user.emailVerifiedAt)})` : `${user.email} (not verified)`],
                        ["Terms accepted", user.termsAcceptedAt ? formatDate(user.termsAcceptedAt) : "Not recorded (account made by the seeder or the admin script)"],
                        ["Posts", `${activity.posts.published} published, ${activity.posts.awaitingReview} awaiting review, ${activity.posts.rejected} rejected`],
                        ["Comments", `${activity.comments} (${activity.commentUpvotes} upvotes, ${activity.commentDownvotes} downvotes received)`],
                        ["Votes cast", String(activity.votesCast)],
                        ["Profile score", String(user.profileScore)],
                        ["Files uploaded", String(activity.uploads)],
                        [
                            excludeRequestId ? "Earlier requests" : "Requests to publish",
                            requests.length > 0 ? (
                                <ul>
                                    {requests.map((request) => (
                                        <li key={request.id}>
                                            <Link href={`/dashboard/admin/requests/${request.id}`} className="text-primary hover:underline">
                                                {request.status} ({formatDate(request.createdAt)})
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                "None"
                            ),
                        ],
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
                            links.length > 0 && (
                                <ul>
                                    {links.map((link) => (
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
        </>
    );
}
