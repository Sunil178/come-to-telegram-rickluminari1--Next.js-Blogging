"use client";

import { useEffect } from "react";

// Fires client-side (not from the server component render) because only a browser
// round-trip can carry the dedupe cookie the view-count route sets.
export default function ViewTracker({ slug }: { slug: string }) {
    useEffect(() => {
        fetch(`/api/posts/${slug}/view`, { method: "POST", keepalive: true }).catch(() => {});
    }, [slug]);

    return null;
}
