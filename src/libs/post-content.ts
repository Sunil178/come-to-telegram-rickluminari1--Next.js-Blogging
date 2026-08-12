import { slugify } from "@/libs/slug";

export interface TocEntry {
    id: string;
    text: string;
    level: number;
}

export interface ProcessedContent {
    html: string;
    toc: TocEntry[];
    readingTime: number;
}

const WORDS_PER_MINUTE = 200;

function headingId(text: string, seen: Map<string, number>): string {
    const base = slugify(text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
}

// Accepts a `document` from a JSDOM window the caller already created (e.g. for
// DOMPurify) instead of spinning up a second JSDOM instance just to walk the DOM.
export function processPostContent(document: Document, sanitizedHtml: string): ProcessedContent {
    const root = document.createElement("div");
    root.innerHTML = sanitizedHtml;

    const headings = root.querySelectorAll("h1, h2, h3");
    const seen = new Map<string, number>();
    const toc: TocEntry[] = [];

    headings.forEach((heading) => {
        const text = heading.textContent?.trim() || "";
        if (!text) return;
        const id = headingId(text, seen);
        heading.id = id;
        toc.push({ id, text, level: Number(heading.tagName.substring(1)) });
    });

    const wordCount = (root.textContent || "").trim().split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

    return { html: root.innerHTML, toc, readingTime };
}
