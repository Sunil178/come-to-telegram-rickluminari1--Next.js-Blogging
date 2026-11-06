import { Suspense } from "react";
import { signupEnabled } from "@/libs/runtime-config";
import LoginForm from "./LoginForm";

export const metadata = { title: "Log in", robots: { index: false } };

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm signupOpen={signupEnabled()} />
        </Suspense>
    );
}
