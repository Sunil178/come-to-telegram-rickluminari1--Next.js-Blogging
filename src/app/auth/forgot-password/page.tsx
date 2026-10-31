"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type AccountFormState } from "@/actions/account";
import FormStatus from "@/components/auth/FormStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: AccountFormState = {};

export default function ForgotPasswordPage() {
    const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Forgot your password?</CardTitle>
                    <CardDescription>Enter your account&apos;s email and we&apos;ll send you a link to choose a new one.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={formAction} className="flex flex-col gap-4">
                        <FormStatus state={state} />
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="email">Email</Label>
                            <Input type="email" id="email" name="email" autoComplete="email" required disabled={pending} />
                        </div>
                        <Button type="submit" className="mt-2" disabled={pending}>
                            {pending ? "Sending…" : "Send reset link"}
                        </Button>
                        <p className="text-center text-sm text-muted-foreground">
                            Remembered it?{" "}
                            <Link href="/auth/login" className="text-primary hover:underline">
                                Log in
                            </Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
