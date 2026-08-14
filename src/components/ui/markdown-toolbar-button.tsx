'use client';

import * as React from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { MarkdownPlugin } from '@platejs/markdown';
import { FileDownIcon } from 'lucide-react';
import { useEditorRef } from 'platejs/react';
import { useFilePicker } from 'use-file-picker';
import type { SelectedFilesOrErrors } from 'use-file-picker/types';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from './dropdown-menu';
import { ToolbarButton } from './toolbar';

export function MarkdownToolbarButton(props: DropdownMenuProps) {
    const editor = useEditorRef();
    const [open, setOpen] = React.useState(false);

    const { openFilePicker } = useFilePicker({
        accept: ['.md', '.markdown'],
        multiple: false,
        readFilesContent: false,
        onFilesSelected: async (data: SelectedFilesOrErrors<undefined, unknown>) => {
            if (!data.plainFiles?.[0]) return;
            const text = await data.plainFiles[0].text();
            const nodes = editor.getApi(MarkdownPlugin).markdown.deserialize(text);
            editor.tf.insertNodes(nodes);
        },
    });

    const exportToMarkdown = () => {
        const markdown = editor.getApi(MarkdownPlugin).markdown.serialize();
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'post.md';
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen} modal={false} {...props}>
            <DropdownMenuTrigger asChild>
                <ToolbarButton pressed={open} tooltip="Markdown" isDropdown>
                    <FileDownIcon />
                </ToolbarButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start">
                <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={openFilePicker}>Import from Markdown</DropdownMenuItem>
                    <DropdownMenuItem onSelect={exportToMarkdown}>Export as Markdown</DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
