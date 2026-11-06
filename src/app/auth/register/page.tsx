import Link from "next/link";
import { signupEnabled } from "@/libs/runtime-config";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import RegisterForm from "./RegisterForm";

export const metadata = { title: "Create an account", robots: { index: false } };

export default function RegisterPage() {
    if (signupEnabled()) return <RegisterForm />;
    return (
        <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">Sign-up is closed</CardTitle>
                    <CardDescription>
                        New accounts can&apos;t be created at the moment. If you already have one,{" "}
                        <Link href="/auth/login" className="text-primary hover:underline">log in</Link>.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}
