'use client';

import * as React from 'react';

import { toggleCodeBlock } from '@platejs/code-block';
import { SquareCode } from 'lucide-react';
import { useEditorRef } from 'platejs/react';

import { ToolbarButton } from './toolbar';

// SquareCode is deliberately not Code2Icon (the inline Code mark next to it) — the two
// were easy to mix up at a glance, and without this button the only way to a real code
// block (language picker + highlighting) is the buried "Turn into" dropdown.
export function CodeBlockToolbarButton(
  props: React.ComponentProps<typeof ToolbarButton>
) {
  const editor = useEditorRef();

  return (
    <ToolbarButton
      {...props}
      onClick={() => {
        toggleCodeBlock(editor);
        editor.tf.focus();
      }}
      tooltip="Code Block"
    >
      <SquareCode />
    </ToolbarButton>
  );
}
