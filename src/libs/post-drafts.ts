import type { Value } from "platejs";

// Editor drafts autosaved to localStorage (CNT-03). Keys carry the user id, and logout clears them all,
// so the next account on a shared browser never sees someone else's draft.
const PREFIX = "post-draft:";

export interface Draft {
    savedAt: number;
    title: string;
    titleDescription: string;
    slug: string;
    tags: string[];
    bannerImage: string;
    publishAt: string;
    // Restored with the draft, so a private post can't come back as one sent for review.
    isPrivate: boolean;
    content: Value;
}

export function draftKey(userId: string, postSlug: string | null): string {
    return `${PREFIX}${userId}:${postSlug ?? "new"}`;
}

// The draft the author hasn't decided on yet: parked here while the restore banner is up, so new
// autosaves to the main key can't overwrite it.
export const pendingKey = (key: string) => `${key}:pending`;

export function readDraft(key: string): Draft | null {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as Draft) : null;
    } catch {
        return null;
    }
}

export function writeDraft(key: string, draft: Draft): boolean {
    try {
        localStorage.setItem(key, JSON.stringify(draft));
        return true;
    } catch {
        return false; // quota exceeded or storage blocked: autosave is best-effort
    }
}

export function removeDraft(key: string): void {
    try {
        localStorage.removeItem(key);
    } catch {
        // storage unavailable: nothing to clean up
    }
}

export function clearAllDrafts(): void {
    try {
        for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    } catch {
        // storage unavailable
    }
}

// Plate gives every block a fresh random id on each load, so content is compared without them.
export function withoutNodeIds(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withoutNodeIds);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "id").map(([key, v]) => [key, withoutNodeIds(v)]));
    }
    return value;
}
