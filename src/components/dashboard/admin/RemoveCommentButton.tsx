"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
        <Button variant="ghost" size="icon-sm" onClick={handleRemove} disabled={pending}>
            <Trash2 />
            <span className="sr-only">Remove comment</span>
        </Button>
    );
}
