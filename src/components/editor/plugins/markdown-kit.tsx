import { MarkdownPlugin } from '@platejs/markdown';
import remarkGfm from 'remark-gfm';

// GFM only (tables, strikethrough, task lists, autolinks) — math, emoji, MDX, and
// mentions are deliberately left out, matching the editor's own scope: no node
// type exists for any of them, so parsing their markdown syntax would have
// nowhere real to go.
export const MarkdownKit = [
    MarkdownPlugin.configure({
        options: {
            remarkPlugins: [remarkGfm],
        },
    }),
];
