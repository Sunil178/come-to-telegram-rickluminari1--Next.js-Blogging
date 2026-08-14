import { MarkdownPlugin } from '@platejs/markdown';
import remarkGfm from 'remark-gfm';

// GFM only — math, emoji, MDX, and mentions are left out since this editor
// has no node type for any of them.
export const MarkdownKit = [
    MarkdownPlugin.configure({
        options: {
            remarkPlugins: [remarkGfm],
        },
    }),
];
