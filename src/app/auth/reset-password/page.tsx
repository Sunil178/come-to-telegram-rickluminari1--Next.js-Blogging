import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata = { title: "Reset password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const { token } = await searchParams;

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Choose a new password</CardTitle>
                    <CardDescription>After saving, you&apos;ll be signed out everywhere and can log in with the new password.</CardDescription>
                </CardHeader>
                <CardContent>
                    {typeof token === "string" && token ? (
                        <ResetPasswordForm token={token} />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            This page needs the link from your reset email.{" "}
                            <Link href="/auth/forgot-password" className="text-primary hover:underline">
                                Request a new link
                            </Link>
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
