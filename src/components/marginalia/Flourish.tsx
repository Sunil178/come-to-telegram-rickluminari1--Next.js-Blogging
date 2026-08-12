"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface FlourishProps {
    className?: string;
    color?: "primary" | "berry" | "current";
    animate?: boolean;
    delay?: number;
}

const COLOR_CLASS: Record<NonNullable<FlourishProps["color"]>, string> = {
    primary: "stroke-primary",
    berry: "stroke-berry",
    current: "stroke-current",
};

export default function Flourish({ className, color = "primary", animate = true, delay = 0 }: FlourishProps) {
    return (
        <svg
            viewBox="0 0 160 12"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden
            className={cn("h-2.5 w-full", className)}
        >
            <motion.path
                d="M2 7.5C22 2 38 2 52 6.5C68 11 88 3 104 5.5C120 8 136 3.5 158 6"
                strokeWidth="2.5"
                strokeLinecap="round"
                className={COLOR_CLASS[color]}
                initial={animate ? { pathLength: 0, opacity: 0 } : undefined}
                animate={animate ? { pathLength: 1, opacity: 1 } : undefined}
                transition={{ duration: 0.6, ease: "easeOut", delay }}
            />
        </svg>
    );
}
