"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function RequestPublishButton() {
    const [pending, startTransition] = useTransition();
    const [sent, setSent] = useState(false);

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

    if (sent) {
        return <p className="text-sm text-muted-foreground">Your request to publish is pending review.</p>;
    }

    return (
        <Button onClick={handleRequest} disabled={pending}>
            {pending ? "Sending…" : "Request to publish"}
        </Button>
    );
}
