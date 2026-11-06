import Link from "next/link";
import { LegalPage, LegalSection, ContactEmail, operatorLabel } from "@/components/legal/LegalPage";
import { siteOperator } from "@/libs/runtime-config";

export const metadata = { title: "Terms of use" };

// Bump when the terms' substance changes.
const LAST_UPDATED = "4 November 2026";

export default function TermsPage() {
    const { location } = siteOperator();

    return (
        <LegalPage title="Terms of use" updated={LAST_UPDATED}>
            <p>
                These terms apply to everyone who reads Vedev.Guru or has an account on it. The site is run by {operatorLabel()} (&ldquo;we&rdquo;). By using the
                site you agree to them; if you don&apos;t, please don&apos;t use it.
            </p>

            <LegalSection title="Who can use the site">
                <ul className="flex flex-col gap-2">
                    <li>Anyone can read public posts without an account.</li>
                    <li><strong>You must be 18 or older to create an account.</strong> We don&apos;t knowingly hold accounts of children; if we learn an account belongs to someone under 18, we delete it.</li>
                    <li>Sign-up and comments can be switched off at times; existing accounts keep working.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Your account">
                <ul className="flex flex-col gap-2">
                    <li>Give accurate details and keep your password to yourself. You are responsible for what happens under your account.</li>
                    <li>You can delete your account at any time from <Link href="/dashboard/account" className="text-primary hover:underline">Account</Link>; the <Link href="/privacy" className="text-primary hover:underline">Privacy policy</Link> explains what is removed.</li>
                    <li>We may suspend or remove an account that breaks these terms or the law.</li>
                </ul>
            </LegalSection>

            <LegalSection title="What you post">
                <p>
                    You keep the rights to the posts, comments and images you add. You give us a non-exclusive, worldwide, royalty-free licence to store, show and
                    format them on the site for as long as they stay on it. You are responsible for what you post and confirm you have the right to share it.
                </p>
                <p>You must not post, upload or share anything that:</p>
                <ul className="flex flex-col gap-2">
                    <li>belongs to someone else and you have no right to share, or infringes a copyright, trademark, patent or other right;</li>
                    <li>is obscene, pornographic, paedophilic, invades someone&apos;s privacy (including their body), or insults or harasses anyone on the basis of gender, religion, caste, race or ethnicity;</li>
                    <li>is harmful to children, promotes money laundering, gambling or real-money gaming, or encourages violence or any offence;</li>
                    <li>deceives readers about where it comes from, is knowingly false or misleading, or impersonates another person;</li>
                    <li>threatens the unity, integrity, defence, security or sovereignty of India, friendly relations with other countries, or public order;</li>
                    <li>contains malware, or is spam, unlabelled advertising or a link scheme;</li>
                    <li>is a realistic AI-generated or edited image, audio or video that isn&apos;t clearly labelled as such;</li>
                    <li>breaks any law in force.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Review and removal">
                <ul className="flex flex-col gap-2">
                    <li>Posts are reviewed by moderators before they go public. We may remove any content or account that breaks these terms.</li>
                    <li>We remove unlawful content when a court or the government orders it, within the time the law sets.</li>
                    <li><strong>Private posts</strong> are visible only to their author and are not reviewed. They still must not break the law, and we act on lawful orders about them.</li>
                    <li>To report content, follow the steps on the <Link href="/contact" className="text-primary hover:underline">Contact</Link> page, which also names our grievance officer.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Our content">
                <ul className="flex flex-col gap-2">
                    <li>Posts share their authors&apos; experience and opinions. They are not professional, legal, financial or medical advice; check anything important for your own situation.</li>
                    <li>The site&apos;s design, name and our own posts belong to us. You may quote short parts with a link back; copying whole posts needs permission.</li>
                    <li>Links to other sites are for convenience; we don&apos;t control those sites.</li>
                    <li>The site may show advertising and use affiliate links, which earn us a small commission at no cost to you. Sponsored posts and affiliate links are labelled as such.</li>
                </ul>
            </LegalSection>

            <LegalSection title="No guarantees">
                <p>
                    The site is provided as it is. We work to keep it running and its content accurate, but we don&apos;t promise it will always be available, free of
                    errors or suitable for a particular purpose. To the extent the law allows, we aren&apos;t liable for indirect losses from using it.
                </p>
            </LegalSection>

            <LegalSection title="Changes and law">
                <ul className="flex flex-col gap-2">
                    <li>We may update these terms; the date at the top shows the latest version, and using the site afterwards means you accept it.</li>
                    <li>These terms are governed by the laws of India. Disputes go to the courts {location ? `at ${location}` : "in India"}.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Contact">
                <p>Questions about these terms: <ContactEmail />.</p>
            </LegalSection>
        </LegalPage>
    );
}
