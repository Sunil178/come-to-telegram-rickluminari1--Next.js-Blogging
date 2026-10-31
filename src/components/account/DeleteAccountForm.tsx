"use client";

import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unsubscribeFromPush } from "@/libs/push-subscription";
import { clearAllDrafts } from "@/libs/post-drafts";

export default function DeleteAccountForm() {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setPending(true);
        try {
            const password = new FormData(event.currentTarget).get("password");
            const response = await fetch("/api/account", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });
            if (!response.ok) {
                const result = await response.json().catch(() => null);
                setError(result?.message ?? "Something went wrong. Please try again.");
                return;
            }
            // The server already removed the push subscriptions; this only drops the browser's copy.
            await unsubscribeFromPush().catch(() => {});
            await signOut({ redirect: false });
            clearAllDrafts();
            toast.success("Your account has been deleted.");
            router.push("/");
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setPending(false);
        }
    }

    if (!confirming) {
        return <Button variant="destructive" onClick={() => setConfirming(true)}>Delete my account…</Button>;
    }

    return (
        <form onSubmit={submit} className="flex max-w-sm flex-col gap-3">
            <p className="text-sm text-foreground">
                This can&apos;t be undone. Your posts are removed, and your comments on other posts are replaced by &ldquo;[deleted]&rdquo;.
            </p>
            <div className="flex flex-col gap-2">
                <Label htmlFor="delete-password">Confirm with your password</Label>
                <Input id="delete-password" name="password" type="password" autoComplete="current-password" required disabled={pending} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
                <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Deleting…" : "Permanently delete account"}</Button>
                <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
            </div>
        </form>
    );
}
