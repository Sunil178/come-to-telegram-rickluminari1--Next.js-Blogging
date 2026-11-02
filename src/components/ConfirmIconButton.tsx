"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmIconButtonProps {
    icon: ReactNode;
    label: string;
    // Shows the label as a text button instead of an icon-only one.
    showLabel?: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    disabled?: boolean;
    onConfirm: () => void;
}

/** An icon button for a destructive action that asks before doing it. */
export default function ConfirmIconButton({ icon, label, showLabel, title, description, confirmLabel, disabled, onConfirm }: ConfirmIconButtonProps) {
    const [open, setOpen] = useState(false);

    const confirm = (event: MouseEvent) => {
        event.preventDefault();
        setOpen(false);
        onConfirm();
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                {showLabel ? (
                    <Button variant="outline" size="sm" disabled={disabled}>
                        {icon}
                        {label}
                    </Button>
                ) : (
                    <Button variant="ghost" size="icon-sm" disabled={disabled}>
                        {icon}
                        <span className="sr-only">{label}</span>
                    </Button>
                )}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={confirm}>
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
