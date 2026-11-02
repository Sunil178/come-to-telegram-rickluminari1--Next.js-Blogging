"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOutOfBrowser } from "@/libs/client-sign-out";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/libs/password-policy";

export default function ChangePasswordForm() {
    const router = useRouter();
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setPending(true);
        try {
            const form = new FormData(event.currentTarget);
            const response = await fetch("/api/account/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(form.entries())),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                setError(result?.message ?? "Couldn't change your password.");
                return;
            }
            // The change signs every session out, this one included.
            await signOutOfBrowser();
            router.refresh();
            router.push("/auth/login?passwordChanged=1");
        } catch {
            setError("Couldn't change your password.");
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={submit} className="flex max-w-sm flex-col gap-4" aria-label="Change password">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="current-password">Current password</Label>
                <Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />
                <p className="text-xs text-muted-foreground">At least {PASSWORD_MIN_LENGTH} characters. You&apos;ll be signed out everywhere and sign in again.</p>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input id="confirm-password" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} required />
            </div>
            {error && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            )}
            <Button type="submit" className="w-fit" disabled={pending}>
                {pending ? "Changing…" : "Change password"}
            </Button>
        </form>
    );
}
