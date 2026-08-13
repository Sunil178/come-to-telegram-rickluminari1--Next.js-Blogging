"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type RegisterState } from "@/actions/register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PasswordFields from "./password";

const initialState: RegisterState = {};

export default function RegisterPage() {
    const [state, formAction, pending] = useActionState(registerAction, initialState);

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Join Vedev.Guru</CardTitle>
                    <CardDescription>Create an account to start writing.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className="flex flex-col gap-4">
                        {state?.error && (
                            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {state.error}
                            </p>
                        )}

                        <Field label="Username" name="username" required disabled={pending} errors={state?.validationErrors?.username} />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="First Name" name="firstName" required disabled={pending} errors={state?.validationErrors?.firstName} />
                            <Field label="Middle Name" name="middleName" disabled={pending} errors={state?.validationErrors?.middleName} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Last Name" name="lastName" required disabled={pending} errors={state?.validationErrors?.lastName} />
                            <Field label="Email" name="email" type="email" required disabled={pending} errors={state?.validationErrors?.email} />
                        </div>

                        <PasswordFields disabled={pending} errors={state?.validationErrors?.password} />

                        <Button type="submit" className="mt-2" disabled={pending}>
                            {pending ? "Creating account…" : "Create Account"}
                        </Button>

                        <p className="text-center text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/auth/login" className="text-primary hover:underline">
                                Log in!
                            </Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

function Field({
    label,
    name,
    type = "text",
    required,
    disabled,
    errors,
}: {
    label: string;
    name: string;
    type?: string;
    required?: boolean;
    disabled?: boolean;
    errors?: string[];
}) {
    return (
        <div className="flex flex-col gap-2">
            <Label htmlFor={name}>
                {label} {required && <span className="text-destructive">*</span>}
            </Label>
            <Input type={type} id={name} name={name} required={required} disabled={disabled} />
            {errors?.map((err, index) => (
                <span key={index} className="text-xs text-destructive">{err}</span>
            ))}
        </div>
    );
}
