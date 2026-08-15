'use client';

import { BlockSelectionPlugin } from '@platejs/selection/react';
import { getPluginTypes, KEYS } from 'platejs';

import { BlockSelection } from '@/components/ui/block-selection';

export const hasSelectableClass = ({
    attributes,
    className,
}: {
    attributes: { className?: string };
    className?: string;
}) =>
    [className, attributes.className]
        .filter(Boolean)
        .join(' ')
        .includes('slate-selectable');

// Required alongside DndKit — block-draggable.tsx calls
// editor.getApi(BlockSelectionPlugin) directly.
export const BlockSelectionKit = [
    BlockSelectionPlugin.configure(({ editor }) => ({
        options: {
            enableContextMenu: true,
            // codeBlock excluded like codeLine/column/td: turning a paragraph into one is a
            // type change, and the overlay's unmount races Slate's own DOM update, crashing React.
            isSelectable: (element) =>
                !getPluginTypes(editor, [KEYS.column, KEYS.codeBlock, KEYS.codeLine, KEYS.td]).includes(element.type),
        },
        render: {
            belowRootNodes: (props) => {
                if (!hasSelectableClass(props)) return null;

                return <BlockSelection {...(props as any)} />;
            },
        },
    })),
];
