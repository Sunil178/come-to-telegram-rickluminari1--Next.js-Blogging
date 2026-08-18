"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface CategoryFormDialogProps {
    category?: { id: string; title: string };
}

export default function CategoryFormDialog({ category }: CategoryFormDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(category?.title ?? "");
    const [pending, startTransition] = useTransition();
    const isEdit = Boolean(category);

    useEffect(() => {
        if (open) setTitle(category?.title ?? "");
    }, [open, category]);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        startTransition(async () => {
            try {
                const response = await fetch(isEdit ? `/api/categories/${category!.id}` : "/api/categories", {
                    method: isEdit ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title }),
                });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to save category.");
                    return;
                }
                toast.success(isEdit ? "Category updated." : "Category created.");
                setOpen(false);
                router.refresh();
            } catch {
                toast.error("Failed to save category.");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {isEdit ? (
                    <Button variant="ghost" size="icon-sm">
                        <Pencil />
                        <span className="sr-only">Edit category</span>
                    </Button>
                ) : (
                    <Button>
                        <Plus /> Add category
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={handleSubmit} method="post">
                    <DialogHeader>
                        <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
                        <DialogDescription>The slug is derived from the title automatically.</DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        <Label htmlFor="category-title">Title</Label>
                        <Input id="category-title" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1.5" />
                    </div>
                    <DialogFooter className="mt-6">
                        <Button type="submit" disabled={pending}>
                            {pending ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
