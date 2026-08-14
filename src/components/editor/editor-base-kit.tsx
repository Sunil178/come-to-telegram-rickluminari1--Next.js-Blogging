import { BaseBasicBlocksKit } from './plugins/basic-blocks-base-kit';
import { BaseBasicMarksKit } from './plugins/basic-marks-base-kit';
import { BaseCodeBlockKit } from './plugins/code-block-base-kit';
import { BaseLinkKit } from './plugins/link-base-kit';
import { BaseListKit } from './plugins/list-base-kit';
import { MarkdownKit } from './plugins/markdown-kit';
import { BaseMediaKit } from './plugins/media-base-kit';
import { BaseTableKit } from './plugins/table-base-kit';

// Server-safe plugin set used only for HTML serialization (see
// src/libs/post-editor-serialize.ts). No 'use client' — this file (and
// everything it imports) must never touch platejs/react. MarkdownKit is safe
// here too — @platejs/markdown has no /react entry point.
export const BaseEditorKit = [
    ...BaseBasicBlocksKit,
    ...BaseBasicMarksKit,
    ...BaseListKit,
    ...BaseLinkKit,
    ...BaseMediaKit,
    ...BaseCodeBlockKit,
    ...BaseTableKit,
    ...MarkdownKit,
];
