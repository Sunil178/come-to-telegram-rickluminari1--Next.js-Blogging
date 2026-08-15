import { createSlateEditor } from "platejs";
import { MarkdownPlugin } from "@platejs/markdown";
import { BaseEditorKit } from "@/components/editor/editor-base-kit";
import { serializePostContent } from "@/libs/post-editor-serialize";

// Same deserialize -> serialize pipeline as the editor's "Import from Markdown",
// so seeded posts get identical HTML to something authored through the app.
export async function markdownToPostHtml(markdown: string): Promise<string> {
    const editor = createSlateEditor({ plugins: BaseEditorKit });
    const value = editor.getApi(MarkdownPlugin).markdown.deserialize(markdown);
    return serializePostContent(value);
}
