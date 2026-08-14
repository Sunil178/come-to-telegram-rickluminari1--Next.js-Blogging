import { BaseBasicBlocksKit } from './plugins/basic-blocks-base-kit';
import { BaseBasicMarksKit } from './plugins/basic-marks-base-kit';
import { BaseCodeBlockKit } from './plugins/code-block-base-kit';
import { BaseLinkKit } from './plugins/link-base-kit';
import { BaseListKit } from './plugins/list-base-kit';
import { MarkdownKit } from './plugins/markdown-kit';
import { BaseMediaKit } from './plugins/media-base-kit';
import { BaseTableKit } from './plugins/table-base-kit';

// Server-safe plugin set for HTML serialization (src/libs/post-editor-serialize.ts) —
// this file must never import platejs/react. MarkdownKit is fine here; it has no /react entry.
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
