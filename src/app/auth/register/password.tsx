"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/libs/password-policy";

interface PasswordFieldsProps {
    disabled?: boolean;
    errors?: string[];
}

function PasswordField({
    id,
    label,
    disabled,
    errors,
    hint,
}: {
    id: string;
    label: string;
    disabled?: boolean;
    errors?: string[];
    hint?: string;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={id}>
                {label} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
                <Input type={visible ? "text" : "password"} id={id} name={id} required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" aria-describedby={hint ? `${id}-hint` : undefined} disabled={disabled} className="pr-9" />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-0.5 right-0.5"
                    onClick={() => setVisible((v) => !v)}
                    aria-label={visible ? "Hide password" : "Show password"}
                >
                    {visible ? <EyeOff /> : <Eye />}
                </Button>
            </div>
            {hint && <span id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</span>}
            {errors?.map((err, index) => (
                <span key={index} className="text-xs text-destructive">{err}</span>
            ))}
        </div>
    );
}

export default function PasswordFields({ disabled = false, errors }: PasswordFieldsProps) {
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField id="password" label="Password" disabled={disabled} errors={errors} hint={`At least ${PASSWORD_MIN_LENGTH} characters.`} />
            <PasswordField id="password_confirmation" label="Confirm Password" disabled={disabled} />
        </div>
    );
}
