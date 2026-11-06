// Read at runtime on the server, not inlined at build like NEXT_PUBLIC_* variables, so one built
// image can be promoted through environments with different values (Next.js self-hosting guide).
export function runtimeEnv(name: string): string {
    return process.env[name] || "";
}

export function vapidPublicKey(): string {
    return runtimeEnv("VAPID_PUBLIC_KEY");
}

// Feature switches are on unless set to false, 0, off or no.
export function featureEnabled(name: string): boolean {
    return !["false", "0", "off", "no"].includes(runtimeEnv(name).trim().toLowerCase());
}

export const signupEnabled = () => featureEnabled("SIGNUP_ENABLED");
export const commentsEnabled = () => featureEnabled("COMMENTS_ENABLED");

// Who runs the site, shown on the About, Contact, Terms and Privacy pages; also the grievance officer.
export function siteOperator() {
    return {
        name: runtimeEnv("OPERATOR_NAME"),
        location: runtimeEnv("OPERATOR_LOCATION"),
        email: runtimeEnv("CONTACT_EMAIL"),
    };
}
