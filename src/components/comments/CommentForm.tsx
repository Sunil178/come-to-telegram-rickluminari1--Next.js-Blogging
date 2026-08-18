"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loginRedirectUrl } from "@/libs/auth-redirect";

interface CommentFormProps {
    isLoggedIn: boolean;
    onSubmit: (content: string) => void;
    onCancel?: () => void;
    autoFocus?: boolean;
    placeholder?: string;
    submitLabel?: string;
    initialValue?: string;
}

export default function CommentForm({
    isLoggedIn,
    onSubmit,
    onCancel,
    autoFocus = false,
    placeholder = "Add to the discussion…",
    submitLabel = "Comment",
    initialValue = "",
}: CommentFormProps) {
    const router = useRouter();
    const [content, setContent] = useState(initialValue);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (!isLoggedIn) {
            router.push(loginRedirectUrl(location.pathname));
            return;
        }
        const trimmed = content.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
        setContent("");
    };

    return (
        <form onSubmit={handleSubmit} method="post" className="flex flex-col gap-3">
            <Textarea
                aria-label="Comment"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={isLoggedIn ? placeholder : "Log in to join the discussion."}
                disabled={!isLoggedIn}
                autoFocus={autoFocus}
                rows={3}
                maxLength={5000}
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
