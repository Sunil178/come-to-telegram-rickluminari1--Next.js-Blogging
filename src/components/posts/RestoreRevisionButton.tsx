"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function RestoreRevisionButton({ slug, revisionId }: { slug: string; revisionId: string }) {
    const router = useRouter();
    const [pending, setPending] = useState(false);

    async function restore() {
        if (!window.confirm("Replace the current post content with this revision? The current version is kept in the history.")) return;
        setPending(true);
        try {
            const response = await fetch(`/api/posts/${slug}/revisions/${revisionId}`, { method: "POST" });
            if (!response.ok) throw new Error();
            toast.success("Revision restored.");
            router.push(`/posts/${slug}/revisions`);
            router.refresh();
        } catch {
            toast.error("Failed to restore the revision.");
        } finally {
            setPending(false);
        }
    }

    return (
        <Button onClick={restore} disabled={pending}>
            {pending ? "Restoring…" : "Restore this version"}
        </Button>
    );
}
