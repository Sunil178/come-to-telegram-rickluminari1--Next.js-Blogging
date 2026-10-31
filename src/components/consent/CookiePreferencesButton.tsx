"use client";

import { OPEN_CONSENT_EVENT } from "@/libs/visitor";

export default function CookiePreferencesButton({ className }: { className?: string }) {
    return (
        <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
            Cookie preferences
        </button>
    );
}
