"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { loginRedirectUrl } from "@/libs/auth-redirect";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DeletePostButtonProps {
    slug: string;
    title: string;
}

export default function DeletePostButton({ slug, title }: DeletePostButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();

    const handleDelete = (event: MouseEvent) => {
        // AlertDialogAction closes the dialog on click by default; block that so
        // it stays open (with its own pending state) until the request settles.
        event.preventDefault();

        startTransition(async () => {
            try {
                const response = await fetch(`/api/posts/${slug}`, { method: "DELETE" });

                if (response.status === 401) {
                    router.push(loginRedirectUrl(location.pathname));
                    return;
                }

                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to delete post.");
                    return;
                }

                toast.success("Post deleted.");
                setOpen(false);
                router.refresh();
            } catch {
                toast.error("Failed to delete post.");
            }
        });
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                    <Trash2 />
                    <span className="sr-only">Delete post</span>
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete &ldquo;{title}&rdquo;?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This moves the post to trash. It won&apos;t be shown publicly, but the data isn&apos;t permanently erased.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={pending}>
                        {pending ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
