import Link from "next/link";
import ContactForm from "@/components/contact/ContactForm";
import { ContactEmail, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import User from "@/models/User";
import { getSession } from "@/libs/api-guard";
import { isContactTopic } from "@/libs/contact";
import { siteOperator } from "@/libs/runtime-config";
import { firstParam, type SearchParamValue } from "@/libs/search-params";

export const metadata = { title: "Contact" };

interface ContactPageProps {
    // "Report" links pass the topic and the address of what is reported.
    searchParams: Promise<{ topic?: SearchParamValue; url?: SearchParamValue }>;
}

export default async function ContactPage({ searchParams }: ContactPageProps) {
    const { name, location, email } = siteOperator();
    const params = await searchParams;
    const topic = firstParam(params.topic);
    const session = await getSession();
    const user = session?.user?.id
        ? await User.findById(session.user.id).select("firstName lastName username email").lean<{ firstName?: string; lastName?: string; username: string; email: string }>()
        : null;

    return (
        <LegalPage title="Contact">
            <p>
                Write to us for anything about the site: questions, corrections, partnerships, reports about a post or comment, or requests about your data.
                {email && <> You can also email <ContactEmail />.</>}
            </p>
            <ContactForm
                defaults={{
                    name: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username : "",
                    email: user?.email ?? "",
                    topic: isContactTopic(topic) ? topic : "",
                    url: (firstParam(params.url) ?? "").slice(0, 500),
                }}
            />

            <LegalSection title="Grievance officer">
                <p>Complaints about content on the site, or about how we handle your personal data, go to our grievance officer:</p>
                <ul className="flex flex-col gap-2">
                    <li><strong>Name:</strong> {name || "the site's operator"}</li>
                    {location && <li><strong>Location:</strong> {location}</li>}
                    <li><strong>Email:</strong> <ContactEmail fallback="use the form above" /></li>
                </ul>
                <p>
                    We acknowledge a complaint within 24 hours and resolve it within 15 days. A complaint about intimate images of you shared without your consent
                    is acted on within 24 hours.
                </p>
            </LegalSection>

            <LegalSection title="Reporting a post, comment or image">
                <p>Use the form above with the topic &ldquo;Report a post, comment or image&rdquo;, or the Report link under any post. So we can act quickly, include:</p>
                <ul className="flex flex-col gap-2">
                    <li>the address (URL) of the post, comment or image;</li>
                    <li>what is wrong with it, and which rule in the <Link href="/terms" className="text-primary hover:underline">Terms of use</Link> or which law it breaks;</li>
                    <li>for copyright: the original work, proof that it&apos;s yours or that you act for the owner, and a statement that the use isn&apos;t authorised;</li>
                    <li>your name and how to reach you.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Your personal data">
                <p>
                    To see, correct or delete your data, start from <Link href="/dashboard/account" className="text-primary hover:underline">Account</Link>, or use the
                    form above. The <Link href="/privacy" className="text-primary hover:underline">Privacy policy</Link> explains your rights. If we don&apos;t resolve a
                    data complaint, you can take it to the Data Protection Board of India.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
