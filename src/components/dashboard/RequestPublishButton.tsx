"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type RequestStatus = "Pending" | "Approved" | "Rejected";

// initialStatus is the reader's latest request, so a reload still shows a pending one.
export default function RequestPublishButton({ initialStatus }: { initialStatus: RequestStatus | null }) {
    const [pending, startTransition] = useTransition();
    const [sent, setSent] = useState(initialStatus === "Pending");

    const handleRequest = () => {
        startTransition(async () => {
            try {
                const response = await fetch("/api/publish-requests", { method: "POST" });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to send request.");
                    return;
                }
                toast.success("Request sent — an admin will review it.");
                setSent(true);
            } catch {
                toast.error("Failed to send request.");
            }
        });
    };

    // The session still says "reader" until its next check, within a minute of the approval.
    if (initialStatus === "Approved") {
        return <p className="text-sm text-muted-foreground">Your request was approved. Writing unlocks within a minute; reload then.</p>;
    }

    if (sent) {
        return <p className="text-sm text-muted-foreground">Your request to publish is pending review.</p>;
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <Button onClick={handleRequest} disabled={pending}>
                {pending ? "Sending…" : initialStatus === "Rejected" ? "Request again" : "Request to publish"}
            </Button>
            {initialStatus === "Rejected" && <p className="text-xs text-muted-foreground">Your last request was declined.</p>}
        </div>
    );
}
