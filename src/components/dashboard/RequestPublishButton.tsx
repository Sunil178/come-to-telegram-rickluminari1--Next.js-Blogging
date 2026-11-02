"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MOTIVATION_LENGTH, SAMPLE_LENGTH } from "@/libs/publish-application";

export type RequestStatus = "Pending" | "Approved" | "Rejected";

export interface ApplicationProfile {
    headline: string;
    bio: string;
    website: string;
    links: string[];
    expertise: string[];
    topics: string[];
}

// initialStatus is the reader's latest request, so a reload still shows a pending one. The form starts
// from the reader's profile, and what they enter in its profile fields is saved back to it.
export default function RequestPublishButton({ initialStatus, profile }: { initialStatus: RequestStatus | null; profile: ApplicationProfile }) {
    const [open, setOpen] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(initialStatus === "Pending");

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setPending(true);
        try {
            // The server splits the list fields (links, expertise, topics) on commas and new lines.
            const body = Object.fromEntries(new FormData(event.currentTarget).entries());
            const response = await fetch("/api/publish-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                setError(result?.message || "Failed to send request.");
                return;
            }
            toast.success("Request sent — an admin will review it.");
            setOpen(false);
            setSent(true);
        } catch {
            setError("Failed to send request.");
        } finally {
            setPending(false);
        }
    }

    // The session still says "reader" until its next check, within a minute of the approval.
    if (initialStatus === "Approved") {
        return <p className="text-sm text-muted-foreground">Your request was approved. Writing unlocks within a minute; reload then.</p>;
    }

    if (sent) {
        return <p className="text-sm text-muted-foreground">Your request to publish is pending review.</p>;
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button>{initialStatus === "Rejected" ? "Request again" : "Request to publish"}</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    <form onSubmit={submit} className="flex flex-col gap-4">
                        <DialogHeader>
                            <DialogTitle>Request to publish</DialogTitle>
                            <DialogDescription>
                                An admin reviews your application and your profile. Details below are saved to your{" "}
                                <Link href="/dashboard/account" className="text-primary hover:underline">profile</Link>.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="application-motivation">Why do you want to write here?</Label>
                            <Textarea id="application-motivation" name="motivation" required minLength={MOTIVATION_LENGTH.min} maxLength={MOTIVATION_LENGTH.max} rows={3} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="application-sample">Writing sample</Label>
                            <Textarea id="application-sample" name="writingSample" required minLength={SAMPLE_LENGTH.min} maxLength={SAMPLE_LENGTH.max} rows={6} />
                            <p className="text-xs text-muted-foreground">A few paragraphs of your own writing ({SAMPLE_LENGTH.min} characters or more).</p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="application-topics">Topics you&apos;d write about</Label>
                            <Input id="application-topics" name="topics" defaultValue={profile.topics.join(", ")} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="application-expertise">Expertise</Label>
                            <Input id="application-expertise" name="expertise" defaultValue={profile.expertise.join(", ")} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="application-headline">Headline</Label>
                            <Input id="application-headline" name="headline" defaultValue={profile.headline} maxLength={120} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="application-bio">Bio</Label>
                            <Textarea id="application-bio" name="bio" defaultValue={profile.bio} maxLength={2000} rows={3} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="application-website">Website</Label>
                            <Input id="application-website" name="website" type="url" defaultValue={profile.website} placeholder="https://" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="application-links">Links to past work</Label>
                            <Textarea id="application-links" name="links" defaultValue={profile.links.join("\n")} rows={2} />
                            <p className="text-xs text-muted-foreground">Up to 5 addresses, one per line.</p>
                        </div>
                        {error && (
                            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {error}
                            </p>
                        )}
                        <DialogFooter>
                            <Button type="submit" disabled={pending}>
                                {pending ? "Sending…" : "Send request"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            {initialStatus === "Rejected" && <p className="text-xs text-muted-foreground">Your last request was declined.</p>}
        </div>
    );
}
