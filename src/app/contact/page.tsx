import Link from "next/link";
import { ContactEmail, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { siteOperator } from "@/libs/runtime-config";

export const metadata = { title: "Contact" };

export default function ContactPage() {
    const { name, location, email } = siteOperator();

    return (
        <LegalPage title="Contact">
            <p>
                {email ? <>Write to <ContactEmail /> for anything about the site: questions, corrections, partnerships, or requests about your data.</> : <>The contact address isn&apos;t set up yet; please check back soon.</>}
            </p>

            <LegalSection title="Grievance officer">
                <p>Complaints about content on the site, or about how we handle your personal data, go to our grievance officer:</p>
                <ul className="flex flex-col gap-2">
                    <li><strong>Name:</strong> {name || "the site's operator"}</li>
                    {location && <li><strong>Location:</strong> {location}</li>}
                    <li><strong>Email:</strong> <ContactEmail fallback="not set up yet" /></li>
                </ul>
                <p>
                    We acknowledge a complaint within 24 hours and resolve it within 15 days. A complaint about intimate images of you shared without your consent
                    is acted on within 24 hours.
                </p>
            </LegalSection>

            <LegalSection title="Reporting a post, comment or image">
                <p>So we can act quickly, include:</p>
                <ul className="flex flex-col gap-2">
                    <li>the address (URL) of the post, comment or image;</li>
                    <li>what is wrong with it, and which rule in the <Link href="/terms" className="text-primary hover:underline">Terms of use</Link> or which law it breaks;</li>
                    <li>for copyright: the original work, proof that it&apos;s yours or that you act for the owner, and a statement that the use isn&apos;t authorised;</li>
                    <li>your name and how to reach you.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Your personal data">
                <p>
                    To see, correct or delete your data, start from <Link href="/dashboard/account" className="text-primary hover:underline">Account</Link>, or write to the
                    address above. The <Link href="/privacy" className="text-primary hover:underline">Privacy policy</Link> explains your rights. If we don&apos;t resolve a
                    data complaint, you can take it to the Data Protection Board of India.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
