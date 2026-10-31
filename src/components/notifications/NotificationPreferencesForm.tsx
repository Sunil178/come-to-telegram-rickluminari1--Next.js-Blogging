"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    NOTIFICATION_CATEGORIES,
    type ChannelPreference,
    type NotificationCategory,
    type NotificationPreferences,
} from "@/libs/notification-types";

interface Props {
    initial: NotificationPreferences;
    categories: NotificationCategory[];
    pushAvailable: boolean;
}

export default function NotificationPreferencesForm({ initial, categories, pushAvailable }: Props) {
    const [prefs, setPrefs] = useState(initial);
    const [saving, setSaving] = useState(false);

    const toggle = (category: NotificationCategory, channel: keyof ChannelPreference, value: boolean) =>
        setPrefs((prev) => ({ ...prev, [category]: { ...prev[category], [channel]: value } }));

    async function save() {
        setSaving(true);
        try {
            const response = await fetch("/api/notifications/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preferences: prefs }),
            });
            if (!response.ok) throw new Error();
            toast.success("Notification preferences saved.");
        } catch {
            toast.error("Failed to save notification preferences.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section aria-labelledby="preferences-heading">
            <h2 id="preferences-heading" className="font-heading text-xl font-semibold text-foreground">Preferences</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Choose what you hear about in the bell and as push notifications{pushAvailable ? "" : " (push isn't set up on this site)"}.
            </p>
            <table className="mt-4 w-full text-sm">
                <thead>
                    <tr className="text-left text-muted-foreground">
                        <th className="py-2 font-medium">Notify me about</th>
                        <th className="w-20 py-2 text-center font-medium">In-app</th>
                        <th className="w-20 py-2 text-center font-medium">Push</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {categories.map((category) => {
                        const label = NOTIFICATION_CATEGORIES[category].label;
                        return (
                            <tr key={category}>
                                <td className="py-3 text-foreground">{label}</td>
                                <td className="py-3 text-center">
                                    <Checkbox
                                        aria-label={`${label}: in-app`}
                                        checked={prefs[category].inApp}
                                        onCheckedChange={(value) => toggle(category, "inApp", value === true)}
                                        className="mx-auto border-muted-foreground/50"
                                    />
                                </td>
                                <td className="py-3 text-center">
                                    <Checkbox
                                        aria-label={`${label}: push`}
                                        checked={prefs[category].push}
                                        disabled={!pushAvailable}
                                        onCheckedChange={(value) => toggle(category, "push", value === true)}
                                        className="mx-auto border-muted-foreground/50"
                                    />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <Button className="mt-4" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save preferences"}
            </Button>
        </section>
    );
}
