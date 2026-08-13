"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldsProps {
    disabled?: boolean;
    errors?: string[];
}

function PasswordField({
    id,
    label,
    disabled,
    errors,
}: {
    id: string;
    label: string;
    disabled?: boolean;
    errors?: string[];
}) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={id}>
                {label} <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
                <Input type={visible ? "text" : "password"} id={id} name={id} required disabled={disabled} className="pr-9" />
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
            {errors?.map((err, index) => (
                <span key={index} className="text-xs text-destructive">{err}</span>
            ))}
        </div>
    );
}

export default function PasswordFields({ disabled = false, errors }: PasswordFieldsProps) {
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField id="password" label="Password" disabled={disabled} errors={errors} />
            <PasswordField id="password_confirmation" label="Confirm Password" disabled={disabled} />
        </div>
    );
}
