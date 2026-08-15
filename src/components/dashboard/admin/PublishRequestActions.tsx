"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function PublishRequestActions({ id }: { id: string }) {
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
            <Button variant="ghost" size="icon-sm" onClick={() => review("approve")} disabled={pending}>
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
                <span className="sr-only">Approve request</span>
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => review("reject")} disabled={pending}>
                <XCircle className="text-destructive" />
                <span className="sr-only">Reject request</span>
            </Button>
        </div>
    );
}
