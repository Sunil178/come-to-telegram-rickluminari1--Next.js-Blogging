import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { siteOperator } from "@/libs/runtime-config";

export const metadata = { title: "About" };

export default function AboutPage() {
    const { name, location } = siteOperator();

    return (
        <LegalPage title="About Vedev.Guru">
            <p className="text-base text-foreground">Essays and notes on technology, culture, and the questions in between.</p>

            <LegalSection title="Who runs it">
                <p>
                    Vedev.Guru is written and run by {name || "an independent writer"}{location ? ` from ${location}` : ""}. It is an independent publication: no
                    company or advertiser decides what gets written.
                </p>
            </LegalSection>

            <LegalSection title="What you'll find">
                <ul className="flex flex-col gap-2">
                    <li>Hands-on tutorials and explainers on software and the web.</li>
                    <li>Longer essays on how technology shapes work and culture.</li>
                    <li>Notes from building things, including what went wrong.</li>
                </ul>
            </LegalSection>

            <LegalSection title="How posts are made">
                <ul className="flex flex-col gap-2">
                    <li>Every public post is reviewed before it goes live, and corrected when readers point out mistakes.</li>
                    <li>Posts may contain affiliate links or, when the site carries them, ads. Sponsored posts and affiliate links are always labelled, and they never decide a recommendation.</li>
                    <li>AI tools may help with research or editing; realistic AI-made images, audio or video are labelled.</li>
                </ul>
            </LegalSection>

            <LegalSection title="Get in touch">
                <p>
                    Suggestions, corrections and questions are welcome on the <Link href="/contact" className="text-primary hover:underline">Contact</Link> page. How we
                    handle your data is in the <Link href="/privacy" className="text-primary hover:underline">Privacy policy</Link>, and the rules for using the site are in
                    the <Link href="/terms" className="text-primary hover:underline">Terms of use</Link>.
                </p>
            </LegalSection>
        </LegalPage>
    );
}
