import { createSlateEditor, type Value } from "platejs";
import { serializeHtml } from "platejs/static";
import { BaseEditorKit } from "@/components/editor/editor-base-kit";

// Converts a Plate document value (as submitted by the client editor) into
// the HTML string stored in Post.content. Server-only — shared by
// POST /api/posts and PATCH /api/posts/[slug] so the two routes never
// diverge on how a post body gets persisted. Read-time sanitization
// (DOMPurify+jsdom in posts/[slug]/page.tsx) remains the actual XSS
// defense; this function only produces markup, it doesn't sanitize it.
export async function serializePostContent(value: Value): Promise<string> {
    const editor = createSlateEditor({ plugins: BaseEditorKit, value });
    return serializeHtml(editor);
}

// Parses the client-submitted `post_data` field (a JSON-encoded Plate
// value) back into a usable Value, or null if it's missing/malformed.
export function parsePostEditorValue(raw: FormDataEntryValue | null): Value | null {
    if (typeof raw !== "string" || !raw) return null;
    try {
        const value = JSON.parse(raw);
        return Array.isArray(value) && value.length > 0 ? value : null;
    } catch {
        return null;
    }
}
