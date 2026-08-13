'use client';

import { useEffect } from 'react';
import type { Value } from 'platejs';
import { usePlateEditor, Plate } from 'platejs/react';

import { Editor, EditorContainer } from '@/components/ui/editor';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EditorKit, type PostEditor as PostEditorInstance } from './editor-kit';

// Creates the editor instance. Lives in the parent (PostForm) rather than
// inside <PostEditor>, so the form's submit handler can read
// `editor.children` directly without an extra onChange-mirrored state value.
//
// initialHtml is deserialized in an effect rather than passed as Plate's
// `value` option directly — HTML deserialization needs the DOM, and this
// page is server-rendered first, so doing it during render crashes SSR
// with "document is not defined" whenever there's existing content to load.
export function usePostEditor(initialHtml?: string): PostEditorInstance {
    const editor = usePlateEditor({ plugins: EditorKit });

    useEffect(() => {
        if (!initialHtml) return;
        // HTML always deserializes to block-level elements at the root, never
        // bare text, so this is safe despite the broader Descendant[] type.
        editor.tf.setValue(editor.api.html.deserialize({ element: initialHtml }) as Value);
        // Only ever needs to run once, right after mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return editor;
}

interface PostEditorProps {
    editor: PostEditorInstance;
}

export function PostEditor({ editor }: PostEditorProps) {
    return (
        <TooltipProvider>
            <Plate editor={editor}>
                <EditorContainer>
                    <Editor placeholder="Write your post…" />
                </EditorContainer>
            </Plate>
        </TooltipProvider>
    );
}
