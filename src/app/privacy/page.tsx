import Link from "next/link";
import { runtimeEnv } from "@/libs/runtime-config";
import { readTtlDays } from "@/libs/notification-ttl";
import { VISITOR_EVENT_TTL_DAYS } from "@/models/VisitorEvent";

export const metadata = { title: "Privacy policy" };

// Bump when the policy's substance changes.
const LAST_UPDATED = "31 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
            {children}
        </section>
    );
}

export default function PrivacyPage() {
    const contact = runtimeEnv("PRIVACY_CONTACT_EMAIL");
    const ttlDays = readTtlDays();

    return (
        <article className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12 text-sm leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
            <header>
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Privacy policy</h1>
                <p className="mt-2">Last updated {LAST_UPDATED}.</p>
            </header>

            <p>
                Vedev.Guru is a blog where people read, write and discuss posts. This page explains what we store, why, for how long, and how you can
                see or delete it. We don&apos;t sell data, show ads, or use third-party analytics or trackers.
            </p>

            <Section title="What we store">
                <ul className="flex flex-col gap-2">
                    <li><strong>Your account:</strong> username, name, email address, a one-way hash of your password (never the password itself), your role, profile text you add, and when you last signed in. Needed to run your account.</li>
                    <li><strong>What you write and do:</strong> posts and their earlier revisions, comments, and votes. Posts and comments are public once published; votes are not shown individually.</li>
                    <li><strong>Notifications:</strong> the in-app notifications you receive and your notification settings. {ttlDays > 0 ? `Read notifications are deleted after ${ttlDays} days.` : "Notifications are kept while your account exists."}</li>
                    <li><strong>Push notifications:</strong> if you turn them on, the delivery address your browser gives us. It&apos;s removed when you sign out or turn push off. Push messages travel through your browser maker&apos;s push service (for example Google or Mozilla).</li>
                    <li><strong>Reading history, only if you accept cookies:</strong> which posts this browser read, kept for {VISITOR_EVENT_TTL_DAYS} days and linked to your account when you sign in, to suggest posts you&apos;ll like. Declining, or withdrawing consent later, deletes this browser&apos;s history.</li>
                    <li><strong>Technical data:</strong> your IP address is used briefly to count each post view once and to rate-limit sign-in attempts; for view counting we keep only a one-way hash of it for 30 minutes. Server logs record errors and request paths for troubleshooting.</li>
                    <li><strong>Emails:</strong> verification and password-reset links are sent through our email provider. The links expire after 24 hours and 1 hour and work once.</li>
                </ul>
            </Section>

            <Section title="Cookies and browser storage">
                <ul className="flex flex-col gap-2">
                    <li><strong>Session cookie</strong> (essential): keeps you signed in, for up to 30 days.</li>
                    <li><strong><code>consent</code></strong> (essential): remembers your cookie choice, for 1 year.</li>
                    <li><strong><code>vid</code></strong> (only if you accept): a random id for this browser&apos;s reading history, for 1 year or until you withdraw consent.</li>
                    <li><strong><code>viewed:…</code></strong> (essential): stops one visit counting twice, for 30 minutes.</li>
                    <li><strong>Editor drafts</strong> are autosaved in your browser&apos;s local storage while you write, and cleared when you sign out.</li>
                </ul>
                <p>You can change your choice at any time with &ldquo;Cookie preferences&rdquo; at the bottom of every page.</p>
            </Section>

            <Section title="Your choices and rights">
                <ul className="flex flex-col gap-2">
                    <li><strong>See your data:</strong> download everything we store about your account from <Link href="/dashboard/account" className="text-primary hover:underline">Account</Link>.</li>
                    <li><strong>Correct it:</strong> edit your posts and comments, or contact us for anything else.</li>
                    <li><strong>Delete it:</strong> delete your account from <Link href="/dashboard/account" className="text-primary hover:underline">Account</Link>. Your account, posts, votes, notifications and reading history are removed permanently; your comments on other people&apos;s posts are replaced by &ldquo;[deleted]&rdquo; so replies to them still make sense. Backups containing it are overwritten within our backup retention period.</li>
                    <li><strong>Withdraw consent:</strong> use &ldquo;Cookie preferences&rdquo; to stop reading history.</li>
                </ul>
            </Section>

            <Section title="Contact">
                <p>
                    Questions or requests about your data:{" "}
                    {contact ? <a href={`mailto:${contact}`} className="text-primary hover:underline">{contact}</a> : "contact the site administrator"}.
                </p>
            </Section>
        </article>
    );
}
