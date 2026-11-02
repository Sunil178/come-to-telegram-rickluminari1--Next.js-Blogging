"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loginRedirectUrl } from "@/libs/auth-redirect";

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
        router.push(loginRedirectUrl(location.pathname));
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
                // Updates after an await leave the transition unless re-wrapped; unwrapped, the optimistic
                // vote is re-applied on top of the server's counts until the transition ends.
                startTransition(() =>
                    setState({
                        upvoteCount: result.data.upvoteCount,
                        downvoteCount: result.data.downvoteCount,
                        myVote: result.data.myVote,
                    })
                );
            } catch {
                toast.error("Failed to record vote.");
            }
        });
    };

    const { upvoteCount, downvoteCount, myVote } = optimisticState;
    const buttonSize = size === "sm" ? "xs" : "sm";
    const iconSize = size === "sm" ? "size-3.5" : "size-4";

    // A count beside each arrow, not one net score: a net score jumps by 2 when a vote switches sides.
    return (
        <div className={cn("inline-flex items-center gap-0.5 rounded-full border border-border px-1 py-0.5", className)}>
            <Button
                type="button"
                variant="ghost"
                size={buttonSize}
                disabled={pending}
                aria-pressed={myVote === true}
                aria-label={`Upvote (${upvoteCount})`}
                onClick={(event) => handleVote(event, true)}
                className={cn("gap-1 rounded-full px-2 font-mono tabular-nums", myVote === true && "text-teal")}
            >
                <ArrowBigUp className={cn(iconSize, myVote === true && "fill-current")} />
                <span>{upvoteCount}</span>
            </Button>
            <span aria-hidden className="h-4 w-px bg-border" />
            <Button
                type="button"
                variant="ghost"
                size={buttonSize}
                disabled={pending}
                aria-pressed={myVote === false}
                aria-label={`Downvote (${downvoteCount})`}
                onClick={(event) => handleVote(event, false)}
                className={cn("gap-1 rounded-full px-2 font-mono tabular-nums", myVote === false && "text-destructive")}
            >
                <ArrowBigDown className={cn(iconSize, myVote === false && "fill-current")} />
                <span>{downvoteCount}</span>
            </Button>
        </div>
    );
}
