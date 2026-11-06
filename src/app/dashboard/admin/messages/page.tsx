import Link from "next/link";
import type { Types } from "mongoose";
import ContactMessage, { RESOLVED_MESSAGE_RETENTION_DAYS, type ContactStatus } from "@/models/ContactMessage";
import User from "@/models/User";
import { Badge } from "@/components/ui/badge";
import MessageStatusButton from "@/components/dashboard/admin/MessageStatusButton";
import PostsPagination from "@/components/posts/PostsPagination";
import { buildSearchParamsHref } from "@/libs/build-href";
import { CONTACT_TOPICS, type ContactTopic } from "@/libs/contact";
import { firstParam, parsePageParam, type SearchParamValue } from "@/libs/search-params";
import { cn } from "@/lib/utils";

export const metadata = { title: "Messages" };

const PAGE_SIZE = 20;
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
// Complaints must be resolved within 15 days of arriving.
const GRIEVANCE_DAYS = 15;
const GRIEVANCE_TOPICS: ContactTopic[] = ["report", "copyright", "privacy", "complaint"];

const FILTERS = { open: "Open", resolved: "Resolved", all: "All" } as const;
type Filter = keyof typeof FILTERS;

interface MessageRow {
    _id: Types.ObjectId;
    reference: string;
    topic: ContactTopic;
    name: string;
    email: string;
    url: string | null;
    message: string;
    userId: Types.ObjectId | null;
    status: ContactStatus;
    resolvedAt: Date | null;
    createdAt: Date;
}

interface AdminMessagesPageProps {
    searchParams: Promise<{ show?: SearchParamValue; page?: SearchParamValue }>;
}

export default async function AdminMessagesPage({ searchParams }: AdminMessagesPageProps) {
    const params = await searchParams;
    const requested = firstParam(params.show);
    const show: Filter = requested === "resolved" || requested === "all" ? requested : "open";
    const page = parsePageParam(params.page);
    const filter = show === "all" ? {} : { status: show };

    const [counts, total, messages] = await Promise.all([
        ContactMessage.aggregate<{ _id: ContactStatus; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        ContactMessage.countDocuments(filter),
        ContactMessage.find(filter).sort({ createdAt: show === "open" ? 1 : -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean<MessageRow[]>(),
    ]);
    const count = (status: ContactStatus) => counts.find((entry) => entry._id === status)?.count ?? 0;
    const tabCount: Record<Filter, number> = { open: count("open"), resolved: count("resolved"), all: count("open") + count("resolved") };
    const senders = await User.find({ _id: { $in: messages.map((m) => m.userId).filter(Boolean) } }).select("username").lean<{ _id: Types.ObjectId; username: string }[]>();
    const usernameOf = (id: Types.ObjectId | null) => (id ? senders.find((user) => user._id.equals(id))?.username : undefined);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const buildHref = ({ page: next }: { page: number }) => buildSearchParamsHref("/dashboard/admin/messages", { show: show === "open" ? undefined : show, page: next > 1 ? next : undefined });
    const now = new Date().getTime();

    return (
        <div className="mx-auto max-w-4xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Messages</h1>
            <p className="mt-2 text-muted-foreground">
                What people sent through the contact form, oldest open message first. Reply by email, then mark it resolved. Complaints are due within {GRIEVANCE_DAYS} days;
                resolved messages are deleted after {RESOLVED_MESSAGE_RETENTION_DAYS} days.
            </p>
            <nav className="mt-6 flex gap-1" aria-label="Which messages">
                {(Object.keys(FILTERS) as Filter[]).map((option) => (
                    <Link
                        key={option}
                        href={option === "open" ? "/dashboard/admin/messages" : `/dashboard/admin/messages?show=${option}`}
                        aria-current={show === option ? "page" : undefined}
                        className={cn("rounded-md px-3 py-1.5 text-sm", show === option ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                        {FILTERS[option]} ({tabCount[option]})
                    </Link>
                ))}
            </nav>

            <ul className="mt-6 flex flex-col gap-4">
                {messages.map((message) => {
                    const username = usernameOf(message.userId);
                    const ageDays = Math.floor((now - new Date(message.createdAt).getTime()) / 86_400_000);
                    const grievance = GRIEVANCE_TOPICS.includes(message.topic);
                    const overdue = message.status === "open" && grievance && ageDays >= GRIEVANCE_DAYS;
                    return (
                        <li key={String(message._id)} className="rounded-xl p-5 ring-1 ring-border" aria-label={`Message ${message.reference}`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-sm text-foreground">{message.reference}</span>
                                        <Badge variant={grievance ? "default" : "secondary"}>{CONTACT_TOPICS[message.topic]}</Badge>
                                        {message.status === "resolved" && <Badge variant="outline">Resolved</Badge>}
                                        {overdue && <Badge variant="destructive">Overdue</Badge>}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {dateFormat.format(new Date(message.createdAt))} UTC ({ageDays === 0 ? "today" : `${ageDays} day${ageDays === 1 ? "" : "s"} ago`})
                                    </p>
                                </div>
                                <MessageStatusButton id={String(message._id)} status={message.status} />
                            </div>
                            <p className="mt-3 text-sm text-foreground">
                                {message.name} ·{" "}
                                <a href={`mailto:${message.email}?subject=${encodeURIComponent(`Re: your message ${message.reference}`)}`} className="text-primary hover:underline">
                                    {message.email}
                                </a>
                                {message.userId && (
                                    <>
                                        {" "}·{" "}
                                        {username ? (
                                            <Link href={`/dashboard/admin/users/${String(message.userId)}`} className="text-primary hover:underline">@{username}</Link>
                                        ) : (
                                            "account deleted"
                                        )}
                                    </>
                                )}
                            </p>
                            {message.url && (
                                <p className="mt-1 text-sm break-all">
                                    <a href={message.url} rel="nofollow noopener noreferrer" target="_blank" className="text-primary hover:underline">{message.url}</a>
                                </p>
                            )}
                            <p className="mt-3 text-sm whitespace-pre-wrap text-foreground">{message.message}</p>
                        </li>
                    );
                })}
                {messages.length === 0 && <li className="py-16 text-center text-sm text-muted-foreground">No {show === "all" ? "" : `${FILTERS[show].toLowerCase()} `}messages.</li>}
            </ul>
            <PostsPagination page={page} totalPages={totalPages} buildHref={buildHref} className="mt-8" />
        </div>
    );
}
