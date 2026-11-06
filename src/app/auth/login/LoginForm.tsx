"use client";

import Link from "next/link";
import { useActionState, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { safeCallbackPath } from "@/libs/auth-redirect";
import { resendVerificationAction, type AccountFormState } from "@/actions/account";
import FormStatus from "@/components/auth/FormStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const NOTICES: Record<string, string> = {
    "registered:verify": "Account created. We've emailed you a link to confirm your address; confirm it, then log in.",
    "registered:1": "Account created. You can log in now.",
    "passwordChanged:1": "Password changed. Log in with your new password.",
    "verified:1": "Email confirmed. You can log in now.",
    "reset:1": "Password changed. Log in with your new password.",
};

export default function LoginForm({ signupOpen }: { signupOpen: boolean }) {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Catch errors passed in the URL (e.g. from the proxy redirect on an expired session)
    const urlError = searchParams.get("error");
    const notice = ["registered", "verified", "reset", "passwordChanged"]
        .map((key) => NOTICES[`${key}:${searchParams.get(key)}`])
        .find(Boolean);


    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setUnverifiedEmail(null);
        setLoading(true);

        const formData = new FormData(event.currentTarget);
        try {
            // redirect: false lets us handle the response manually
            const result = await signIn("credentials", {
                username: formData.get("username"),
                password: formData.get("password"),
                redirect: false,
            });

            if (result?.code === "email_unverified") {
                setUnverifiedEmail(String(formData.get("username")));
                return;
            }
            if (result?.error) {
                setError(
                    result.code === "rate_limited"
                        ? "Too many sign-in attempts. Please try again later."
                        : "Invalid email or password. Please try again."
                );
                return;
            }
            // Only follow same-site paths, to avoid an open redirect.
            router.push(safeCallbackPath(searchParams.get("callbackUrl"), window.location.origin));
            router.refresh(); // forces a refresh to pick up the new session
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Welcome back</CardTitle>
                    <CardDescription>Log in to Vedev.Guru to manage your posts.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} method="post" className="flex flex-col gap-4">
                        {!unverifiedEmail && (
                            <FormStatus
                                state={
                                    error || urlError
                                        ? { error: error || "Authentication failed. Please check your credentials." }
                                        : { message: notice }
                                }
                            />
                        )}

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="username">Email</Label>
                            <Input type="email" id="username" name="username" autoComplete="email" required />
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                                    Forgot password?
                                </Link>
                            </div>
                            <Input type="password" id="password" name="password" autoComplete="current-password" required />
                        </div>

                        <Button type="submit" className="mt-2" disabled={loading}>
                            {loading ? "Logging in…" : "Log in"}
                        </Button>

                        {signupOpen && (
                            <p className="text-center text-sm text-muted-foreground">
                                Don&apos;t have an account?{" "}
                                <Link href="/auth/register" className="text-primary hover:underline">
                                    Sign up!
                                </Link>
                            </p>
                        )}
                    </form>
                    {unverifiedEmail && <ResendVerification email={unverifiedEmail} />}
                </CardContent>
            </Card>
        </div>
    );
}

function ResendVerification({ email }: { email: string }) {
    const [state, formAction, pending] = useActionState(resendVerificationAction, {} as AccountFormState);

    return (
        <form action={formAction} className="mt-4 flex flex-col gap-3 rounded-md border border-border p-3">
            <p role="alert" className="text-sm text-foreground">
                Please confirm your email address before logging in. Check your inbox for the link we sent.
            </p>
            <FormStatus state={state} />
            <input type="hidden" name="email" value={email} />
            <Button type="submit" variant="outline" size="sm" disabled={pending || Boolean(state.message)}>
                {pending ? "Sending…" : "Resend confirmation email"}
            </Button>
        </form>
    );
}
