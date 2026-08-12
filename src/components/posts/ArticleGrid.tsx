"use client";

import { Children, type ReactNode } from "react";
import { motion } from "motion/react";

const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
} as const;

const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
} as const;

export default function ArticleGrid({ children }: { children: ReactNode }) {
    return (
        <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={container}
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
            {Children.map(children, (child) => (
                <motion.div variants={item}>{child}</motion.div>
            ))}
        </motion.div>
    );
}
