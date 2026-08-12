"use client";

import Link from "next/link";
import styles from "@/styles/login.module.css";
import Password from "./password"; // Ensure this is also .tsx
import { registerAction } from "@/actions/register";
import { useActionState } from 'react'

// Define the shape of our action response
interface RegisterState {
    error?: string;
    validationErrors?: Record<string, string[]>;
    success?: boolean;
}

// Set the initial state to match the structure
const initialState: RegisterState = {
    error: undefined,
    validationErrors: {},
    success: false,
};

export default function Register() {
    const [state, formAction, pending] = useActionState<RegisterState, FormData>(registerAction, initialState)

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div className={styles.register}>
                    {/* formAction connects the form to our server-side logic */}
                    <form action={formAction}>
                        <h2 className={styles.cardTab}>
                            <span className={styles.active}>Join Vedev.Guru</span>
                        </h2>

                        {/* Error Handling UI */}
                        {state?.error && <div className={styles.error_banner} role="alert">{state.error}</div>}

                        <div className={styles.section}>
                            <label htmlFor="username" className="required">
                                Username
                            </label>
                            <input type="text" id="username" name="username" required disabled={pending} />
                            {state?.validationErrors?.username?.map((err, index) => (
                                <span key={index} className={styles.field_error}>{err}</span>
                            ))}
                        </div>

                        <div className={styles.x_section}>
                            <div className={styles.section}>
                                <label htmlFor="firstName" className="required">
                                    First Name
                                </label>
                                <input type="text" id="firstName" name="firstName" required disabled={pending} />
                                {state?.validationErrors?.firstName?.map((err, index) => (
                                    <span key={index} className={styles.field_error}>{err}</span>
                                ))}
                            </div>

                            <div className={styles.section}>
                                <label htmlFor="middleName">Middle Name</label>
                                <input type="text" id="middleName" name="middleName" disabled={pending} />
                                {state?.validationErrors?.middleName?.map((err, index) => (
                                    <span key={index} className={styles.field_error}>{err}</span>
                                ))}
                            </div>
                        </div>

                        <div className={styles.x_section}>
                            <div className={styles.section}>
                                <label htmlFor="lastName" className="required">
                                    Last Name
                                </label>
                                <input type="text" id="lastName" name="lastName" required disabled={pending} />
                                {state?.validationErrors?.lastName?.map((err, index) => (
                                    <span key={index} className={styles.field_error}>{err}</span>
                                ))}
                            </div>

                            <div className={styles.section}>
                                <label htmlFor="email" className="required">
                                    Email
                                </label>
                                <input type="email" id="email" name="email" required disabled={pending} />
                                {state?.validationErrors?.email?.map((err, index) => (
                                    <span key={index} className={styles.field_error}>{err}</span>
                                ))}
                            </div>
                        </div>

                        {/* Note: Ensure Password component accepts the new theme styles */}
                        <Password disabled={pending} />

                        <div className={styles.section}>
                            <button type="submit" className={styles.submit_btn} disabled={pending}>
                                {pending ? "Creating account..." : "Create Account"}
                            </button>
                        </div>

                        <div className={styles.x_section}>
                            <span>Already have an account?</span>
                            <Link href="/auth/login" className={styles.link}>
                                Log in!
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
