"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface VoteState {
    upvoteCount: number;
    downvoteCount: number;
    myVote: boolean | null;
}

interface VoteButtonsProps {
    voteUrl: string;
    initialState: VoteState;
    isLoggedIn: boolean;
    size?: "default" | "sm";
    className?: string;
}

function applyVote(current: VoteState, type: boolean): VoteState {
    if (current.myVote === type) {
        return {
            upvoteCount: current.upvoteCount - (type ? 1 : 0),
            downvoteCount: current.downvoteCount - (type ? 0 : 1),
            myVote: null,
        };
    }
    if (current.myVote === null) {
        return {
            upvoteCount: current.upvoteCount + (type ? 1 : 0),
            downvoteCount: current.downvoteCount + (type ? 0 : 1),
            myVote: type,
        };
    }
    return {
        upvoteCount: current.upvoteCount + (type ? 1 : -1),
        downvoteCount: current.downvoteCount + (type ? -1 : 1),
        myVote: type,
    };
}

export default function VoteButtons({ voteUrl, initialState, isLoggedIn, size = "default", className }: VoteButtonsProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [state, setState] = useState(initialState);
    const [optimisticState, applyOptimistic] = useOptimistic(state, applyVote);

    const requireLogin = () => {
        router.push(`/auth/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
    };

    const handleVote = (event: React.MouseEvent, type: boolean) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isLoggedIn) {
            requireLogin();
            return;
        }
        startTransition(async () => {
            applyOptimistic(type);
            try {
                const response = await fetch(voteUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type }),
                });
                if (response.status === 401) {
                    requireLogin();
                    return;
                }
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to record vote.");
                    return;
                }
                setState({
                    upvoteCount: result.data.upvoteCount,
                    downvoteCount: result.data.downvoteCount,
                    myVote: result.data.myVote,
                });
            } catch {
                toast.error("Failed to record vote.");
            }
        });
    };

    const score = optimisticState.upvoteCount - optimisticState.downvoteCount;
    const buttonSize = size === "sm" ? "icon-xs" : "icon-sm";

    return (
        <div className={cn("inline-flex items-center gap-1 rounded-full border border-border px-1 py-0.5", className)}>
            <Button
                type="button"
                variant="ghost"
                size={buttonSize}
                disabled={pending}
                aria-pressed={optimisticState.myVote === true}
                onClick={(event) => handleVote(event, true)}
                className={cn(optimisticState.myVote === true && "text-teal")}
            >
                <ArrowBigUp className={cn(optimisticState.myVote === true && "fill-current")} />
                <span className="sr-only">Upvote</span>
            </Button>
            <span className="min-w-4 text-center font-mono text-xs tabular-nums text-muted-foreground">{score}</span>
            <Button
                type="button"
                variant="ghost"
                size={buttonSize}
                disabled={pending}
                aria-pressed={optimisticState.myVote === false}
                onClick={(event) => handleVote(event, false)}
                className={cn(optimisticState.myVote === false && "text-destructive")}
            >
                <ArrowBigDown className={cn(optimisticState.myVote === false && "fill-current")} />
                <span className="sr-only">Downvote</span>
            </Button>
        </div>
    );
}
