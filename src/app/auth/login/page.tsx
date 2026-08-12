"use client";

import Link from 'next/link';
import styles from '@/styles/login.module.css';
import { signIn } from "next-auth/react";
import { Suspense, useState, SubmitEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Login() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}

function LoginForm() {
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Catch errors passed in the URL (e.g., from middleware or initial load)
    const urlError = searchParams.get("error");

    // Only follow same-site paths; reject protocol-relative URLs (e.g. "//evil.com") to avoid an open redirect.
    const callbackUrl = searchParams.get("callbackUrl");
    const redirectTo = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/posts";

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("username") as string;
        const password = formData.get("password") as string;

        try {
            // Note: redirect: false allows us to handle the response manually
            const res = await signIn("credentials", {
                username: email,
                password: password,
                redirect: false,
            });

            if (res?.error) {
                // NextAuth provides specific error strings like "CredentialsSignin"
                setError("Invalid email or password. Please try again.");
            } else {
                router.push(redirectTo);
                router.refresh(); // Forces a refresh to update the session state
            }
        } catch (err) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.login}>
                    <form onSubmit={handleSubmit}>
                        {/* Show Error Message UI */}
                        {(error || urlError) && (
                            <div className={styles.error_banner} style={{ color: 'red', marginBottom: '1rem' }}>
                                {error || "Authentication failed. Please check your credentials."}
                            </div>
                        )}

                        <div className={styles.section}>
                            <label htmlFor='username'>Email</label>
                            <input type="email" id='username' name="username" required />
                        </div>

                        <div className={styles.section}>
                            <label htmlFor='password'>Password</label>
                            <input type="password" id='password' name='password' required />
                        </div>

                        <div className={styles.section}>
                            <button type='submit' disabled={loading}>
                                {loading ? "Logging in..." : "Login"}
                            </button>
                        </div>

                        <div className={styles.x_section}>
                            <span>Don’t have an account? </span>
                            <Link href="/auth/register" className={styles.link}>Sign up!</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}