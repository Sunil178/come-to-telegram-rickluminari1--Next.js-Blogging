"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PostApprovalActionsProps {
    slug: string;
    title: string;
}

export default function PostApprovalActions({ slug, title }: PostApprovalActionsProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [rejectOpen, setRejectOpen] = useState(false);
    const [reason, setReason] = useState("");

    const setApproval = (approval: "Approved" | "Rejected", rejectionReason = "") => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/posts/${slug}/approval`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ approval, reason: rejectionReason }),
                });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to update approval.");
                    return;
                }
                toast.success(approval === "Approved" ? "Post approved." : "Post rejected.");
                setRejectOpen(false);
                setReason("");
                router.refresh();
            } catch {
                toast.error("Failed to update approval.");
            }
        });
    };

    const handleReject = (event: FormEvent) => {
        event.preventDefault();
        setApproval("Rejected", reason);
    };

    return (
        <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setApproval("Approved")} disabled={pending}>
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
                <span className="sr-only">Approve post</span>
            </Button>
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon-sm" disabled={pending}>
                        <XCircle className="text-destructive" />
                        <span className="sr-only">Reject post</span>
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <form onSubmit={handleReject}>
                        <DialogHeader>
                            <DialogTitle>Reject &ldquo;{title}&rdquo;?</DialogTitle>
                            <DialogDescription>The author sees your reason on the post&apos;s edit page and can resubmit after changing it.</DialogDescription>
                        </DialogHeader>
                        <div className="my-4">
                            <Label htmlFor={`reject-reason-${slug}`}>Reason (optional)</Label>
                            <Textarea id={`reject-reason-${slug}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} className="mt-1.5" />
                        </div>
                        <DialogFooter>
                            <Button type="submit" variant="destructive" disabled={pending}>
                                Reject post
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
