"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import ConfirmIconButton from "@/components/ConfirmIconButton";

// Approving changes the person's role, so both answers ask first.
export default function PublishRequestActions({ id, requester }: { id: string; requester: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const review = (action: "approve" | "reject") => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/publish-requests/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action }),
                });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to review request.");
                    return;
                }
                toast.success(action === "approve" ? "Request approved — user is now an Author." : "Request rejected.");
                router.refresh();
            } catch {
                toast.error("Failed to review request.");
            }
        });
    };

    return (
        <div className="flex justify-end gap-1">
            <ConfirmIconButton
                icon={<CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />}
                label="Approve request"
                title={`Make ${requester} an author?`}
                description="They can write posts right away; each post still goes to a moderator for review. They're told by notification."
                confirmLabel="Approve"
                tone="default"
                disabled={pending}
                onConfirm={() => review("approve")}
            />
            <ConfirmIconButton
                icon={<XCircle className="text-destructive" />}
                label="Reject request"
                title={`Reject ${requester}'s request to publish?`}
                description="They stay a reader and are told by notification. They can ask again later."
                confirmLabel="Reject"
                disabled={pending}
                onConfirm={() => review("reject")}
            />
        </div>
    );
}
