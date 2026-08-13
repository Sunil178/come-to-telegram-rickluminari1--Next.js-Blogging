"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import Flourish from "@/components/marginalia/Flourish";

export default function Hero() {
    return (
        <div className="relative overflow-hidden px-6 py-20 text-center">
            <motion.div
                aria-hidden
                className="pointer-events-none absolute -top-40 left-1/2 h-105 w-160 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl"
                animate={{ opacity: [0.5, 0.9, 0.5], y: [0, 24, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
                aria-hidden
                className="pointer-events-none absolute -top-20 left-[calc(50%+220px)] h-80 w-105 -translate-x-1/2 rounded-full bg-magenta/20 blur-3xl"
                animate={{ opacity: [0.4, 0.8, 0.4], y: [0, -20, 0] }}
                transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            />
            <motion.div
                aria-hidden
                className="pointer-events-none absolute -top-24 left-[calc(50%-260px)] h-64 w-80 -translate-x-1/2 rounded-full bg-teal/20 blur-3xl"
                animate={{ opacity: [0.35, 0.7, 0.35], y: [0, 16, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            />
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative"
            >
                <p className="font-mono text-xs tracking-[0.3em] text-teal uppercase">Vedev · Guru</p>
                <h1 className="mx-auto mt-5 max-w-2xl font-heading text-6xl leading-[1.05] font-medium text-foreground">
                    Ideas worth reading,
                    <br />
                    <span className="relative inline-block font-semibold">
                        written with care.
                        <Flourish className="absolute inset-x-0 -bottom-2" color="magenta" delay={0.5} />
                    </span>
                </h1>
                <p className="mx-auto mt-7 max-w-lg text-lg text-muted-foreground">
                    Essays and deep dives on technology, culture, and the questions in between.
                </p>
                <Button size="lg" className="animate-pulse-glow mt-8 rounded-full px-8" asChild>
                    <Link href="/posts">Start reading →</Link>
                </Button>
            </motion.div>
        </div>
    );
}
