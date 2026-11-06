import Link from "next/link";
import { LegalPage, LegalSection as Section, ContactEmail, operatorLabel } from "@/components/legal/LegalPage";
import { readTtlDays } from "@/libs/notification-ttl";
import { VISITOR_EVENT_TTL_DAYS } from "@/models/VisitorEvent";

export const metadata = { title: "Privacy policy" };

// Bump when the policy's substance changes.
const LAST_UPDATED = "4 November 2026";

export default function PrivacyPage() {
    const ttlDays = readTtlDays();

    return (
        <LegalPage title="Privacy policy" updated={LAST_UPDATED}>
            <p>
                Vedev.Guru is a blog where people read, write and discuss posts. This page explains what we store, why, for how long, and how you can
                see or delete it. We don&apos;t sell data, show ads, or use third-party analytics or trackers. It is written to meet India&apos;s Digital
                Personal Data Protection Act, 2023.
            </p>

            <Section title="Who is responsible">
                <p>
                    {operatorLabel()} decides why and how this data is used (the &ldquo;data fiduciary&rdquo;) and answers for it. Contact: <ContactEmail />. The
                    grievance officer is named on the <Link href="/contact" className="text-primary hover:underline">Contact</Link> page.
                </p>
            </Section>

            <Section title="What we store">
                <ul className="flex flex-col gap-2">
                    <li><strong>Your account:</strong> username, name, email address, a one-way hash of your password (never the password itself), your role and your profile photo. Needed to run your account.</li>
                    <li><strong>Profile, only what you choose to add:</strong> a public part shown on your author page (headline, bio, country, city, website and links, expertise, topics, education) and private details only you and the site&apos;s admins see (date of birth, gender, phone, address). Every field is optional; edit or clear it any time from <Link href="/dashboard/account" className="text-primary hover:underline">Account</Link>.</li>
                    <li><strong>Requests to publish:</strong> why you want to write and your writing sample, kept with the request so admins can review it.</li>
                    <li><strong>Where you sign in from:</strong> the IP address and its approximate location (country, region, city) when you create your account, when you last signed in and when you ask to publish. Only admins see them, to judge requests to publish and to spot abuse. They&apos;re kept for as long as your account exists.</li>
                    <li><strong>Images you upload:</strong> who uploaded each one, when, and what the original file said about itself (camera, lens, editing software, when and where it was taken, if your device recorded it). Only you, in your data export, and the site&apos;s admins see this. The copy served to readers has all of that removed, so a photo never reveals where it was taken.</li>
                    <li><strong>What you write and do:</strong> posts and their earlier revisions, comments, and votes. Posts and comments are public once published; votes are not shown individually.</li>
                    <li><strong>Your agreement:</strong> when you confirmed being 18 or older and accepted the terms at sign-up.</li>
                    <li><strong>Notifications:</strong> the in-app notifications you receive and your notification settings. {ttlDays > 0 ? `Read notifications are deleted after ${ttlDays} days.` : "Notifications are kept while your account exists."}</li>
                    <li><strong>Push notifications:</strong> if you turn them on, the delivery address your browser gives us. It&apos;s removed when you sign out or turn push off. Push messages travel through your browser maker&apos;s push service (for example Google or Mozilla).</li>
                    <li><strong>Reading history, only if you accept cookies:</strong> which posts this browser read, kept for {VISITOR_EVENT_TTL_DAYS} days and linked to your account when you sign in, to suggest posts you&apos;ll like. Declining, or withdrawing consent later, deletes this browser&apos;s history.</li>
                    <li><strong>Technical data:</strong> your IP address is used briefly to count each post view once and to rate-limit sign-in attempts; for view counting we keep only a one-way hash of it for 30 minutes. Server logs record errors and request paths for troubleshooting. Locations come from an offline database on our server; your address isn&apos;t sent to anyone else.</li>
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

            <Section title="Why we use it">
                <ul className="flex flex-col gap-2">
                    <li><strong>To run your account and show what you publish:</strong> you give this data to use the service, and you can withdraw by deleting your account.</li>
                    <li><strong>Reading history:</strong> only with your consent, which you can withdraw at any time.</li>
                    <li><strong>Security and abuse prevention:</strong> sign-in addresses, rate limits and logs, to keep accounts and the site safe.</li>
                    <li>We don&apos;t use your data for anything else, and we don&apos;t sell or share it except with the services named on this page that help run the site.</li>
                </ul>
            </Section>

            <Section title="Children">
                <p>
                    Accounts are for people aged 18 or older; sign-up asks you to confirm it. We don&apos;t knowingly collect children&apos;s data, track children or
                    show them targeted content. If we learn an account belongs to a child, we delete it. Parents or guardians can ask us to.
                </p>
            </Section>

            <Section title="Your choices and rights">
                <ul className="flex flex-col gap-2">
                    <li><strong>See your data:</strong> download everything we store about your account from <Link href="/dashboard/account" className="text-primary hover:underline">Account</Link>.</li>
                    <li><strong>Correct it:</strong> edit your profile, posts and comments, or contact us for anything else.</li>
                    <li><strong>Delete it:</strong> delete your account from <Link href="/dashboard/account" className="text-primary hover:underline">Account</Link>. Your account, posts, votes, notifications and reading history are removed permanently; your comments on other people&apos;s posts are replaced by &ldquo;[deleted]&rdquo; so replies to them still make sense. Backups containing it are overwritten within our backup retention period.</li>
                    <li><strong>Withdraw consent:</strong> use &ldquo;Cookie preferences&rdquo; to stop reading history. Withdrawing is as easy as giving consent and doesn&apos;t affect anything before it.</li>
                    <li><strong>Nominate someone:</strong> you can name a person to use these rights for you if you die or can&apos;t act yourself; write to us with their details.</li>
                    <li><strong>Complain:</strong> write to the grievance officer first. We answer within 15 days; if you aren&apos;t satisfied, you can complain to the Data Protection Board of India.</li>
                </ul>
            </Section>

            <Section title="Security and breaches">
                <p>
                    Passwords are stored only as one-way hashes, connections use HTTPS, and access to the server is restricted. If a breach affects your data, we tell
                    you and the Data Protection Board without delay, with what happened and what you can do.
                </p>
            </Section>

            <Section title="Credits">
                <p>
                    <a href="https://db-ip.com" className="text-primary hover:underline">IP Geolocation by DB-IP</a>, licensed under{" "}
                    <a href="https://creativecommons.org/licenses/by/4.0/" className="text-primary hover:underline">CC BY 4.0</a>.
                </p>
            </Section>

            <Section title="Contact">
                <p>
                    Questions or requests about your data: <ContactEmail />. See the <Link href="/contact" className="text-primary hover:underline">Contact</Link> page for
                    the grievance officer.
                </p>
            </Section>
        </LegalPage>
    );
}
