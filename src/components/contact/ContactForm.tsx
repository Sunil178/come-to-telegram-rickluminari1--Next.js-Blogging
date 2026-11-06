"use client";

import { useState, type FormEvent } from "react";
import NativeSelect from "@/components/NativeSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_LIMITS, CONTACT_TOPICS, TOPICS_NEEDING_LINK, type ContactTopic } from "@/libs/contact";

interface ContactFormProps {
    defaults: { name: string; email: string; topic: ContactTopic | ""; url: string };
}


export default function ContactForm({ defaults }: ContactFormProps) {
    const [topic, setTopic] = useState<ContactTopic | "">(defaults.topic);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [reference, setReference] = useState("");

    async function send(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSending(true);
        try {
            const body = Object.fromEntries(new FormData(event.currentTarget).entries());
            const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                setError(response.status === 429 ? "You've sent several messages already. Please wait an hour, or email us directly." : (result?.message ?? "Couldn't send your message."));
                return;
            }
            setReference(result.data.reference);
        } catch {
            setError("Couldn't send your message. Check your connection and try again.");
        } finally {
            setSending(false);
        }
    }

    if (reference) {
        return (
            <div role="status" className="rounded-lg border border-border bg-card p-5 text-foreground">
                <p className="font-medium">Thanks, your message is on its way.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                    Your reference is <strong className="font-mono">{reference}</strong>; quote it if you write again. We&apos;ll reply to the email address you gave.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setReference("")}>
                    Send another message
                </Button>
            </div>
        );
    }

    const needsLink = topic !== "" && TOPICS_NEEDING_LINK.includes(topic);

    return (
        <form onSubmit={send} aria-label="Contact form" className="relative flex flex-col gap-4 rounded-lg border border-border bg-card p-5 text-foreground">
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-topic">What is it about?</Label>
                <NativeSelect id="contact-topic" name="topic" required value={topic} onChange={(e) => setTopic(e.target.value as ContactTopic | "")}>
                    <option value="" disabled>
                        Choose a topic
                    </option>
                    {Object.entries(CONTACT_TOPICS).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </NativeSelect>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact-name">Your name</Label>
                    <Input id="contact-name" name="name" required maxLength={CONTACT_LIMITS.name} defaultValue={defaults.name} autoComplete="name" />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="contact-email">Your email</Label>
                    <Input id="contact-email" name="email" type="email" required maxLength={CONTACT_LIMITS.email} defaultValue={defaults.email} autoComplete="email" />
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-url">{needsLink ? "Link to the post, comment or image" : "Link (optional)"}</Label>
                <Input id="contact-url" name="url" type="url" required={needsLink} maxLength={CONTACT_LIMITS.url} defaultValue={defaults.url} placeholder="https://" />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea id="contact-message" name="message" required minLength={CONTACT_LIMITS.message.min} maxLength={CONTACT_LIMITS.message.max} rows={6} />
                <p className="text-xs text-muted-foreground">
                    {needsLink
                        ? "Say what is wrong with it and which rule or law it breaks. For copyright, describe your original work and how you own it."
                        : `At least ${CONTACT_LIMITS.message.min} characters.`}
                </p>
            </div>
            {/* Hidden from people and screen readers; only bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="contact-trap">Leave this empty</label>
                <input id="contact-trap" name="leave_empty" type="text" tabIndex={-1} autoComplete="new-password" />
            </div>
            {error && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            )}
            <Button type="submit" className="w-fit" disabled={sending}>
                {sending ? "Sending…" : "Send message"}
            </Button>
        </form>
    );
}
