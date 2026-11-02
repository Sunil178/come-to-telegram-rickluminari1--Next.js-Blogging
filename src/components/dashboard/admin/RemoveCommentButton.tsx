"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmIconButton from "@/components/ConfirmIconButton";

export default function RemoveCommentButton({ id }: { id: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const handleRemove = () => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/comments/${id}`, { method: "DELETE" });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to remove comment.");
                    return;
                }
                toast.success("Comment removed.");
                router.refresh();
            } catch {
                toast.error("Failed to remove comment.");
            }
        });
    };

    return (
        <ConfirmIconButton
            icon={<Trash2 />}
            label="Remove comment"
            title="Remove this comment?"
            description="Its text is removed for everyone. Replies stay under a [deleted] placeholder."
            confirmLabel="Remove"
            disabled={pending}
            onConfirm={handleRemove}
        />
    );
}
