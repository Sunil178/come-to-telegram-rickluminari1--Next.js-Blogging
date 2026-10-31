import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import VerifyEmailForm from "./VerifyEmailForm";

export const metadata = { title: "Confirm email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const { token } = await searchParams;

    return (
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Confirm your email</CardTitle>
                    <CardDescription>One click and your account is ready.</CardDescription>
                </CardHeader>
                <CardContent>
                    {typeof token === "string" && token ? (
                        <VerifyEmailForm token={token} />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            This page needs the link from your confirmation email.{" "}
                            <Link href="/auth/login" className="text-primary hover:underline">
                                Log in to request a new one
                            </Link>
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
