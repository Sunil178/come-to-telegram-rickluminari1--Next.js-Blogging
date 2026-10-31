interface CspOptions {
    nonce: string;
    isDev: boolean;
    upgradeInsecureRequests: boolean;
}

// Per the Next.js CSP guide (nonce + strict-dynamic). style-src keeps 'unsafe-inline': React
// server-renders style="" attributes and Sonner/Radix inject <style> tags, which nonces can't cover.
// img-src allows https: because post bodies may embed external images.
export function buildContentSecurityPolicy({ nonce, isDev, upgradeInsecureRequests }: CspOptions): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data: https:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        ...(upgradeInsecureRequests ? ["upgrade-insecure-requests"] : []),
    ].join("; ");
}
