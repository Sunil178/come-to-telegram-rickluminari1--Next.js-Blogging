"use client";

import { Children, type ReactNode } from "react";
import { motion } from "motion/react";

export default function ArticleGrid({ children }: { children: ReactNode }) {
    // Each card animates on its own: Children.map keys the wrappers by the cards' keys, so cards that arrive by a client
    // navigation (search, paging) mount fresh and fade in, while cards already shown keep their state.
    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Children.map(children, (child, index) => (
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.4, ease: "easeOut", delay: Math.min(index, 8) * 0.08 }}
                >
                    {child}
                </motion.div>
            ))}
        </div>
    );
}
