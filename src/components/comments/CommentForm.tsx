"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentFormProps {
    isLoggedIn: boolean;
    onSubmit: (content: string) => void;
    onCancel?: () => void;
    autoFocus?: boolean;
    placeholder?: string;
    submitLabel?: string;
}

export default function CommentForm({
    isLoggedIn,
    onSubmit,
    onCancel,
    autoFocus = false,
    placeholder = "Add to the discussion…",
    submitLabel = "Comment",
}: CommentFormProps) {
    const router = useRouter();
    const [content, setContent] = useState("");

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        const trimmed = content.trim();
        if (!trimmed) return;
        if (!isLoggedIn) {
            router.push(`/auth/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
            return;
        }
        onSubmit(trimmed);
        setContent("");
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={isLoggedIn ? placeholder : "Log in to join the discussion."}
                disabled={!isLoggedIn}
                autoFocus={autoFocus}
                rows={3}
            />
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" size="sm" disabled={isLoggedIn && content.trim().length === 0}>
                    {isLoggedIn ? submitLabel : "Log in"}
                </Button>
            </div>
        </form>
    );
}
