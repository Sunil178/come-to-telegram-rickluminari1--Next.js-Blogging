import { createHash } from "node:crypto";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { processPostContent, type ProcessedContent } from "@/libs/post-content";

// One window and DOMPurify instance per process: creating a JSDOM window per request cost tens of
// milliseconds and leaked memory (windows were never closed). Sanitizing is synchronous, so sharing is safe.
let shared: { document: Document; purify: ReturnType<typeof DOMPurify> } | null = null;

function sharedDom() {
    if (!shared) {
        const { window } = new JSDOM("");
        shared = { document: window.document, purify: DOMPurify(window as unknown as Window & typeof globalThis) };
    }
    return shared;
}

export function sanitizePostHtml(html: string): string {
    return sharedDom().purify.sanitize(html);
}

// Rendered posts keyed by a hash of their HTML, so popular posts aren't re-sanitized on every view and an
// edit can never be served stale (hashing is far cheaper than sanitizing).
const MAX_CACHED = 500;
const MAX_CACHED_BYTES = 50 * 1024 * 1024;
// Larger posts are rendered on every view rather than crowding out the rest.
const MAX_ENTRY_BYTES = 1024 * 1024;
const cache = new Map<string, ProcessedContent>();
let cachedBytes = 0;
const entryBytes = (entry: ProcessedContent) => entry.html.length * 2;

export function renderPostContent(html: string): ProcessedContent {
    const versionKey = createHash("sha256").update(html).digest("base64");
    const hit = cache.get(versionKey);
    if (hit) {
        // Re-inserted to keep the Map ordered by last use.
        cache.delete(versionKey);
        cache.set(versionKey, hit);
        return hit;
    }
    const result = processPostContent(sharedDom().document, sanitizePostHtml(html));
    if (entryBytes(result) > MAX_ENTRY_BYTES) return result;
    cache.set(versionKey, result);
    cachedBytes += entryBytes(result);
    while (cache.size > MAX_CACHED || cachedBytes > MAX_CACHED_BYTES) {
        const oldest = cache.keys().next().value!;
        cachedBytes -= entryBytes(cache.get(oldest)!);
        cache.delete(oldest);
    }
    return result;
}
