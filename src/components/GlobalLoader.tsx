"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { isValidLink } from "@/libs/helpers";

export default function GlobalLoader() {
    const pathname = usePathname();
    const searchParamsString = useSearchParams().toString();

    const [loading, setLoading] = useState(false);
    const [trackedRoute, setTrackedRoute] = useState({ pathname, searchParamsString });

    if (trackedRoute.pathname !== pathname || trackedRoute.searchParamsString !== searchParamsString) {
        setTrackedRoute({ pathname, searchParamsString });
        setLoading(false);
    }

    useEffect(() => {
        const handleClick = (event: PointerEvent) => {
            if (event.target instanceof HTMLElement) {
                const linkElement = event.target.closest("a") as HTMLAnchorElement | null;
                if (linkElement && linkElement.getAttribute("data-loader-link-stop")) {
                    setLoading(false);
                } else if (linkElement && (isValidLink(linkElement.href) || linkElement.getAttribute("data-loader-link-start"))) {
                    setLoading(true);
                }
            }
        };
        document.addEventListener("click", handleClick);
        return () => {
            document.removeEventListener("click", handleClick);
        };
    });

    return (
        <AnimatePresence>
            {loading && (
                <motion.div
                    className="fixed inset-x-0 top-0 z-9999 h-0.5 origin-left bg-primary"
                    initial={{ scaleX: 0, opacity: 1 }}
                    animate={{ scaleX: 0.8, transition: { duration: 1.2, ease: "easeOut" } }}
                    exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.2 } }}
                />
            )}
        </AnimatePresence>
    );
}
