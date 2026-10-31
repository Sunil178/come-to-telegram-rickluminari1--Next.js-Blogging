import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/libs/csp";

describe("buildContentSecurityPolicy", () => {
    it("allows scripts only by nonce in production, with no unsafe-eval", () => {
        const csp = buildContentSecurityPolicy({ nonce: "abc123", isDev: false, upgradeInsecureRequests: true });
        expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
        expect(csp).not.toContain("unsafe-eval");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("frame-ancestors 'self'");
        expect(csp).toContain("upgrade-insecure-requests");
    });

    it("adds unsafe-eval in development only, and omits upgrade-insecure-requests for http origins", () => {
        const csp = buildContentSecurityPolicy({ nonce: "abc123", isDev: true, upgradeInsecureRequests: false });
        expect(csp).toContain("'unsafe-eval'");
        expect(csp).not.toContain("upgrade-insecure-requests");
    });

    it("is a single header-safe line", () => {
        expect(buildContentSecurityPolicy({ nonce: "n", isDev: false, upgradeInsecureRequests: false })).not.toMatch(/\n/);
    });
});
