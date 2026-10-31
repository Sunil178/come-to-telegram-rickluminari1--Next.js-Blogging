// Read at runtime on the server, not inlined at build like NEXT_PUBLIC_* variables, so one built
// image can be promoted through environments with different values (Next.js self-hosting guide).
// Legacy NEXT_PUBLIC_* names are accepted as fallbacks; they're read by computed key because Next
// inlines literal `process.env.NEXT_PUBLIC_*` accesses at build time, even in server code.
export function runtimeEnv(name: string): string {
    return process.env[name] || process.env[`NEXT_PUBLIC_${name}`] || "";
}

export function vapidPublicKey(): string {
    return runtimeEnv("VAPID_PUBLIC_KEY");
}
