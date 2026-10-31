"use client";

import { useEffect, useState, useTransition } from "react";
import { setConsentAction } from "@/actions/consent";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OPEN_CONSENT_EVENT, type ConsentChoice } from "@/libs/visitor";

// The root layout passes the stored choice; the banner shows until there is one, and the footer's
// "Cookie preferences" reopens it so consent can be withdrawn as easily as it was given.
export default function ConsentBanner({ initialChoice }: { initialChoice: ConsentChoice | null }) {
    const [open, setOpen] = useState(initialChoice === null);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        const reopen = () => setOpen(true);
        window.addEventListener(OPEN_CONSENT_EVENT, reopen);
        return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
    }, []);

    if (!open) return null;

    const choose = (choice: ConsentChoice) =>
        startTransition(async () => {
            await setConsentAction(choice);
            setOpen(false);
        });

    return (
        <div role="dialog" aria-label="Cookie consent" aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-lg border border-border bg-card p-4 shadow-lg">
            <p className="text-sm text-foreground">
                May we remember which posts you read on this browser? We use one first-party cookie to suggest posts you&apos;ll like,
                and attach that history to your account if you sign in. No third parties, no ads. Declining deletes it.{" "}
                <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">Privacy policy</Link>
            </p>
            <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => choose("denied")}>Decline</Button>
                <Button size="sm" disabled={pending} onClick={() => choose("granted")}>Accept</Button>
            </div>
        </div>
    );
}
