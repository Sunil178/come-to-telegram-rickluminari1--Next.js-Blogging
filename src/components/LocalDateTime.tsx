"use client";

import { useEffect, useState } from "react";

// Formats a timestamp in the viewer's timezone. Server rendering would use the server's zone (UTC in
// Docker), so the formatted text only appears after mount; the ISO value is in dateTime meanwhile.
export default function LocalDateTime({ iso, className }: { iso: string; className?: string }) {
    const [text, setText] = useState("");
    useEffect(() => {
        Promise.resolve().then(() => setText(new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })));
    }, [iso]);
    return <time dateTime={iso} className={className}>{text || "\u00a0"}</time>;
}
