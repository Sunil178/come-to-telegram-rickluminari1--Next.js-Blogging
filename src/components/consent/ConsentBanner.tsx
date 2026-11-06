"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { setConsentAction } from "@/actions/consent";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OPEN_CONSENT_EVENT, type ConsentChoice } from "@/libs/visitor";

// The root layout passes the stored choice; the banner shows until there is one, and the footer's
// "Cookie preferences" reopens it, showing the current choice, so consent can be withdrawn as easily as it was given.
export default function ConsentBanner({ initialChoice }: { initialChoice: ConsentChoice | null }) {
    const [choice, setChoice] = useState(initialChoice);
    const [open, setOpen] = useState(initialChoice === null);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        const reopen = () => setOpen(true);
        window.addEventListener(OPEN_CONSENT_EVENT, reopen);
        return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
    }, []);

    useEffect(() => {
        if (!open || choice === null) return;
        const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", closeOnEscape);
        return () => window.removeEventListener("keydown", closeOnEscape);
    }, [open, choice]);

    if (!open) return null;

    const choose = (next: ConsentChoice) =>
        startTransition(async () => {
            await setConsentAction(next);
            setChoice(next);
            setOpen(false);
        });

    return (
        <div role="dialog" aria-label="Cookie consent" aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-lg border border-border bg-card p-4 shadow-lg">
            {choice !== null && (
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute top-2 right-2 rounded-sm p-1 text-muted-foreground hover:text-foreground">
                    <X className="size-4" />
                </button>
            )}
            <p className="text-sm text-foreground">
                May we remember which posts you read on this browser? We use one first-party cookie to suggest posts you&apos;ll like,
                and attach that history to your account if you sign in. No third parties, no ads. Declining deletes it.{" "}
                <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">Privacy policy</Link>
            </p>
            {choice !== null && (
                <p className="mt-2 text-sm font-medium text-foreground">
                    Your current choice: {choice === "granted" ? "accepted, reading history is remembered" : "declined, nothing is remembered"}.
                </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
                <Button variant={choice === "denied" ? "default" : "outline"} size="sm" disabled={pending} aria-pressed={choice === null ? undefined : choice === "denied"} onClick={() => choose("denied")}>
                    {choice === "denied" ? "Keep declined" : "Decline"}
                </Button>
                <Button variant={choice === "denied" ? "outline" : "default"} size="sm" disabled={pending} aria-pressed={choice === null ? undefined : choice === "granted"} onClick={() => choose("granted")}>
                    {choice === "granted" ? "Keep accepted" : "Accept"}
                </Button>
            </div>
        </div>
    );
}
