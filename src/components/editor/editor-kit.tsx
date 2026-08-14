'use client';

import { TrailingBlockPlugin, type Value } from 'platejs';
import type { TPlateEditor } from 'platejs/react';

import { AutoformatKit } from './plugins/autoformat-kit';
import { BasicBlocksKit } from './plugins/basic-blocks-kit';
import { BlockSelectionKit } from './plugins/block-selection-kit';
import { BasicMarksKit } from './plugins/basic-marks-kit';
import { CodeBlockKit } from './plugins/code-block-kit';
import { DndKit } from './plugins/dnd-kit';
import { FixedToolbarKit } from './plugins/fixed-toolbar-kit';
import { LinkKit } from './plugins/link-kit';
import { ListKit } from './plugins/list-kit';
import { MarkdownKit } from './plugins/markdown-kit';
import { MediaKit } from './plugins/media-kit';
import { TableKit } from './plugins/table-kit';

// The interactive editor's full plugin set, including Plate UI components.
// Client-only — never import this from server code (see editor-base-kit.tsx).
export const EditorKit = [
    ...BasicBlocksKit,
    ...BasicMarksKit,
    ...ListKit,
    ...LinkKit,
    ...MediaKit,
    ...CodeBlockKit,
    ...TableKit,
    ...MarkdownKit,
    TrailingBlockPlugin,

    // UI
    ...AutoformatKit,
    ...BlockSelectionKit,
    ...DndKit,
    ...FixedToolbarKit,
];

export type PostEditor = TPlateEditor<Value, (typeof EditorKit)[number]>;
