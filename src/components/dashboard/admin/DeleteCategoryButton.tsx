"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmIconButton from "@/components/ConfirmIconButton";

export default function DeleteCategoryButton({ id, title }: { id: string; title: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/categories/${id}`, { method: "DELETE" });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to delete category.");
                    return;
                }
                toast.success("Category deleted.");
                router.refresh();
            } catch {
                toast.error("Failed to delete category.");
            }
        });
    };

    return (
        <ConfirmIconButton
            icon={<Trash2 />}
            label="Delete category"
            title={`Delete the "${title}" category?`}
            description="Only a category without posts can be deleted."
            confirmLabel="Delete"
            disabled={pending}
            onConfirm={handleDelete}
        />
    );
}
