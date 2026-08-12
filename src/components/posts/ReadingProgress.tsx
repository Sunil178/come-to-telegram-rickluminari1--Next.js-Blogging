"use client";

import { useEffect, useState } from "react";
import { motion, useScroll } from "motion/react";

export default function ReadingProgress() {
    const { scrollYProgress } = useScroll();
    const [scrollable, setScrollable] = useState(false);

    useEffect(() => {
        // A page that fits entirely within the viewport has nothing to show progress
        // for; scrollYProgress resolves to 1 (already at the end) in that case, which
        // would render as a full bar before the reader has scrolled at all.
        const checkScrollable = () => {
            setScrollable(document.documentElement.scrollHeight > document.documentElement.clientHeight);
        };
        checkScrollable();
        window.addEventListener("resize", checkScrollable);
        return () => window.removeEventListener("resize", checkScrollable);
    }, []);

    if (!scrollable) return null;

    return (
        <motion.div
            className="fixed inset-x-0 top-0 z-40 h-0.5 origin-left bg-primary"
            style={{ scaleX: scrollYProgress }}
        />
    );
}
