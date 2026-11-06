import { siteOperator } from "@/libs/runtime-config";

export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
    return (
        <article className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12 text-sm leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
            <header>
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
                {updated && <p className="mt-2">Last updated {updated}.</p>}
            </header>
            {children}
        </article>
    );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
            {children}
        </section>
    );
}

// The contact address as a link, or a plain fallback while CONTACT_EMAIL isn't set.
export function ContactEmail({ fallback = "the site administrator" }: { fallback?: string }) {
    const { email } = siteOperator();
    return email ? <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a> : <>{fallback}</>;
}

export function operatorLabel(): string {
    const { name, location } = siteOperator();
    if (name && location) return `${name}, ${location}`;
    return name || "the site's operator";
}
