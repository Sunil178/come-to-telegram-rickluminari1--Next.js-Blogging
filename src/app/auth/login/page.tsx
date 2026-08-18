"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    // Catch errors passed in the URL (e.g. from the proxy redirect on an expired session)
    const urlError = searchParams.get("error");

    // Only follow same-site paths; reject protocol-relative URLs (e.g. "//evil.com") to avoid an open redirect.
    const callbackUrl = searchParams.get("callbackUrl");
    const redirectTo = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/posts";

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData(event.currentTarget);
        try {
            // redirect: false lets us handle the response manually
            const result = await signIn("credentials", {
                username: formData.get("username"),
                password: formData.get("password"),
                redirect: false,
            });

            if (result?.error) {
                setError("Invalid email or password. Please try again.");
                return;
            }
            router.push(redirectTo);
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
                        {(error || urlError) && (
                            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {error || "Authentication failed. Please check your credentials."}
                            </p>
                        )}

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="username">Email</Label>
                            <Input type="email" id="username" name="username" required />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="password">Password</Label>
                            <Input type="password" id="password" name="password" required />
                        </div>

                        <Button type="submit" className="mt-2" disabled={loading}>
                            {loading ? "Logging in…" : "Login"}
                        </Button>

                        <p className="text-center text-sm text-muted-foreground">
                            Don&apos;t have an account?{" "}
                            <Link href="/auth/register" className="text-primary hover:underline">
                                Sign up!
                            </Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
