"use client";

import { motion } from "motion/react";
import { BookOpen, Globe, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FEATURES = [
    { icon: Lightbulb, title: "Innovative Ideas", description: "Get the latest opinions & creative insights.", accent: "primary" },
    { icon: BookOpen, title: "In-Depth Articles", description: "Well-researched blogs and technology deep dives.", accent: "magenta" },
    { icon: Globe, title: "Global Reach", description: "Content that connects with audiences worldwide.", accent: "teal" },
] as const;

const ACCENT_CLASS: Record<(typeof FEATURES)[number]["accent"], string> = {
    primary: "text-primary",
    magenta: "text-magenta",
    teal: "text-teal",
};

const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1 } },
} as const;

const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
} as const;

export default function Features() {
    return (
        <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={container}
            className="mx-auto grid max-w-5xl gap-6 px-6 py-8 sm:grid-cols-3"
        >
            {FEATURES.map(({ icon: Icon, title, description, accent }) => (
                <motion.div key={title} variants={item}>
                    <Card className="h-full items-center gap-2 border-none py-8 text-center shadow-none ring-1 ring-border">
                        <CardContent className="flex flex-col items-center gap-2">
                            <Icon className={cn("size-7", ACCENT_CLASS[accent])} />
                            <h3 className="font-heading text-xl font-semibold text-foreground">{title}</h3>
                            <p className="text-sm text-muted-foreground">{description}</p>
                        </CardContent>
                    </Card>
                </motion.div>
            ))}
        </motion.div>
    );
}
