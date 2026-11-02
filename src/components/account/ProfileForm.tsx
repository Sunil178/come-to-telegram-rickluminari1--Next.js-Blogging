"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import AccountCard from "@/components/account/AccountCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GENDER_OPTIONS } from "@/libs/profile";

export interface ProfileFormValues {
    username: string;
    avatar: string;
    headline: string;
    bio: string;
    country: string;
    city: string;
    website: string;
    links: string[];
    expertise: string[];
    topics: string[];
    education: string;
    dateOfBirth: string;
    gender: string;
    phone: string;
    address: string;
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

export default function ProfileForm({ initial }: { initial: ProfileFormValues }) {
    const router = useRouter();
    const [avatar, setAvatar] = useState(initial.avatar);
    const [saving, setSaving] = useState(false);
    const [photoPending, setPhotoPending] = useState(false);
    const [error, setError] = useState("");
    const fileInput = useRef<HTMLInputElement>(null);

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSaving(true);
        try {
            // The server splits links on new lines and expertise and topics on commas or new lines.
            const body = Object.fromEntries(new FormData(event.currentTarget).entries());
            const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                setError(result?.message ?? "Couldn't save your profile.");
                return;
            }
            toast.success("Profile saved.");
            router.refresh();
        } catch {
            setError("Couldn't save your profile.");
        } finally {
            setSaving(false);
        }
    }

    // One photo request at a time; a network failure shows the same toast as a refused upload.
    async function changePhoto(request: () => Promise<Response>, done: (result: { data?: { avatar?: string } } | null) => void, failure: string) {
        setPhotoPending(true);
        try {
            const response = await request();
            const result = await response.json().catch(() => null);
            if (!response.ok) {
                toast.error(result?.message ?? failure);
                return;
            }
            done(result);
            router.refresh();
        } catch {
            toast.error(failure);
        } finally {
            setPhotoPending(false);
        }
    }

    function uploadPhoto(file: File) {
        const form = new FormData();
        form.set("file", file);
        return changePhoto(
            () => fetch("/api/account/avatar", { method: "POST", body: form }),
            (result) => {
                setAvatar(result?.data?.avatar ?? "");
                toast.success("Photo updated.");
            },
            "Couldn't upload the photo."
        );
    }

    function removePhoto() {
        return changePhoto(
            () => fetch("/api/account/avatar", { method: "DELETE" }),
            () => {
                setAvatar("");
                toast.success("Photo removed.");
            },
            "Couldn't remove the photo."
        );
    }

    return (
        <form onSubmit={save} className="flex flex-col gap-6" aria-label="Profile">
            <AccountCard title="Photo" description="Shown next to your name on posts, comments and your author page.">
                <div className="flex items-center gap-4">
                    <Avatar size="lg" className="size-16">
                        <AvatarImage src={avatar || undefined} alt="Your photo" />
                        <AvatarFallback className="text-xl">{initial.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex gap-2">
                        <input
                            ref={fileInput}
                            id="profile-photo"
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            aria-label="Profile photo"
                            className="sr-only"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadPhoto(file);
                                e.target.value = "";
                            }}
                        />
                        <Button type="button" variant="outline" size="sm" disabled={photoPending} onClick={() => fileInput.current?.click()}>
                            {avatar ? "Change photo" : "Upload photo"}
                        </Button>
                        {avatar && (
                            <Button type="button" variant="ghost" size="sm" disabled={photoPending} onClick={removePhoto}>
                                Remove photo
                            </Button>
                        )}
                    </div>
                </div>
            </AccountCard>

            <AccountCard as="fieldset" title="Public profile" description="Shown on your author page. Everything is optional.">
                <Field id="profile-headline" label="Headline" hint="One line, for example “Backend engineer writing about Rust”.">
                    <Input id="profile-headline" name="headline" defaultValue={initial.headline} maxLength={120} />
                </Field>
                <Field id="profile-bio" label="Bio">
                    <Textarea id="profile-bio" name="bio" defaultValue={initial.bio} maxLength={2000} rows={4} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="profile-country" label="Country">
                        <Input id="profile-country" name="country" defaultValue={initial.country} maxLength={80} autoComplete="country-name" />
                    </Field>
                    <Field id="profile-city" label="City">
                        <Input id="profile-city" name="city" defaultValue={initial.city} maxLength={80} autoComplete="address-level2" />
                    </Field>
                </div>
                <Field id="profile-website" label="Website">
                    <Input id="profile-website" name="website" type="url" defaultValue={initial.website} placeholder="https://" autoComplete="url" />
                </Field>
                <Field id="profile-links" label="Other links" hint="Up to 5 addresses (portfolio, GitHub, LinkedIn…), one per line.">
                    <Textarea id="profile-links" name="links" defaultValue={initial.links.join("\n")} rows={3} />
                </Field>
                <Field id="profile-expertise" label="Expertise" hint="Up to 10, separated by commas.">
                    <Input id="profile-expertise" name="expertise" defaultValue={initial.expertise.join(", ")} />
                </Field>
                <Field id="profile-topics" label="Topics you write about" hint="Up to 10, separated by commas.">
                    <Input id="profile-topics" name="topics" defaultValue={initial.topics.join(", ")} />
                </Field>
                <Field id="profile-education" label="Education">
                    <Input id="profile-education" name="education" defaultValue={initial.education} maxLength={300} />
                </Field>
            </AccountCard>

            <AccountCard as="fieldset" title="Private details" description="Only you and the site's admins see these. Everything is optional.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="private-dob" label="Date of birth">
                        <Input id="private-dob" name="dateOfBirth" type="date" defaultValue={initial.dateOfBirth} autoComplete="bday" />
                    </Field>
                    <Field id="private-gender" label="Gender">
                        <Input id="private-gender" name="gender" list="gender-options" defaultValue={initial.gender} maxLength={40} />
                        <datalist id="gender-options">
                            {GENDER_OPTIONS.map((option) => (
                                <option key={option} value={option} />
                            ))}
                        </datalist>
                    </Field>
                </div>
                <Field id="private-phone" label="Phone">
                    <Input id="private-phone" name="phone" type="tel" defaultValue={initial.phone} autoComplete="tel" />
                </Field>
                <Field id="private-address" label="Address">
                    <Textarea id="private-address" name="address" defaultValue={initial.address} maxLength={300} rows={2} autoComplete="street-address" />
                </Field>
            </AccountCard>

            {error && (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            )}
            <Button type="submit" className="w-fit" disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
            </Button>
        </form>
    );
}
