"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function DeleteCategoryButton({ id }: { id: string }) {
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
        <Button variant="ghost" size="icon-sm" onClick={handleDelete} disabled={pending}>
            <Trash2 />
            <span className="sr-only">Delete category</span>
        </Button>
    );
}
