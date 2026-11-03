// Read at runtime on the server, not inlined at build like NEXT_PUBLIC_* variables, so one built
// image can be promoted through environments with different values (Next.js self-hosting guide).
export function runtimeEnv(name: string): string {
    return process.env[name] || "";
}

export function vapidPublicKey(): string {
    return runtimeEnv("VAPID_PUBLIC_KEY");
}
