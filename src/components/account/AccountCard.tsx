import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AccountCardProps {
    title: string;
    description?: ReactNode;
    children: ReactNode;
    // A fieldset keeps a form's groups labelled; standalone sections are page regions.
    as?: "section" | "fieldset";
    tone?: "default" | "danger";
}

export default function AccountCard({ title, description, children, as = "section", tone = "default" }: AccountCardProps) {
    const id = useId();
    const className = cn("min-w-0 rounded-xl border bg-card shadow-xs", tone === "danger" ? "border-destructive/40" : "border-border");
    const descriptionBlock = description && <p className="text-sm text-muted-foreground">{description}</p>;
    const body = <div className="flex flex-col gap-4 px-6 py-5">{children}</div>;

    if (as === "fieldset") {
        // The legend must be the fieldset's first child; floating it keeps it inside the border instead of on it.
        return (
            <fieldset className={className}>
                <legend className="float-left w-full px-6 pt-4">
                    <h2 className="font-heading text-xl font-semibold text-foreground">{title}</h2>
                </legend>
                <div className="clear-both flex flex-col gap-1 border-b border-border px-6 pt-1 pb-4">{descriptionBlock}</div>
                {body}
            </fieldset>
        );
    }

    return (
        <section aria-labelledby={id} className={className}>
            <div className="flex flex-col gap-1 border-b border-border px-6 py-4">
                <h2 id={id} className="font-heading text-xl font-semibold text-foreground">{title}</h2>
                {descriptionBlock}
            </div>
            {body}
        </section>
    );
}
