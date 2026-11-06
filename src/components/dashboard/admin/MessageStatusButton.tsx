"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ContactStatus } from "@/models/ContactMessage";

export default function MessageStatusButton({ id, status }: { id: string; status: ContactStatus }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const next: ContactStatus = status === "open" ? "resolved" : "open";

    const change = () =>
        startTransition(async () => {
            try {
                const response = await fetch(`/api/contact/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
                const result = await response.json().catch(() => null);
                if (!response.ok) {
                    toast.error(result?.message ?? "Couldn't update the message.");
                    return;
                }
                toast.success(next === "resolved" ? "Marked resolved." : "Reopened.");
                router.refresh();
            } catch {
                toast.error("Couldn't update the message.");
            }
        });

    return (
        <Button variant={status === "open" ? "default" : "outline"} size="sm" disabled={pending} onClick={change}>
            {status === "open" ? "Mark resolved" : "Reopen"}
        </Button>
    );
}
