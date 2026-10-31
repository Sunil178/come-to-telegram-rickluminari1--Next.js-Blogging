import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp, rateLimitKey } from "@/libs/client-ip";

function requestWith(headers: Record<string, string>) {
    return new NextRequest("http://localhost/", { headers });
}

describe("getClientIp", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("takes the hop appended by the single trusted proxy by default, ignoring client-supplied entries to its left", () => {
        expect(getClientIp(requestWith({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
    });

    it("counts TRUSTED_PROXY_HOPS from the right for a chain of proxies", () => {
        vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
        expect(getClientIp(requestWith({ "x-forwarded-for": "6.6.6.6, 203.0.113.7, 10.0.0.2" }))).toBe("203.0.113.7");
    });

    it("uses CLIENT_IP_HEADER when configured, e.g. Cloudflare's cf-connecting-ip", () => {
        vi.stubEnv("CLIENT_IP_HEADER", "cf-connecting-ip");
        expect(getClientIp(requestWith({ "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "6.6.6.6" }))).toBe("198.51.100.4");
    });

    it("fails closed when the chain is shorter than the configured hops (a proxy was bypassed)", () => {
        vi.stubEnv("TRUSTED_PROXY_HOPS", "3");
        expect(getClientIp(requestWith({ "x-forwarded-for": "203.0.113.7" }))).toBe("unknown");
    });

    it("doesn't trust a client-supplied X-Real-IP", () => {
        expect(getClientIp(requestWith({ "x-real-ip": "6.6.6.6" }))).toBe("unknown");
    });

    it("returns unknown when no address is available", () => {
        expect(getClientIp(requestWith({}))).toBe("unknown");
    });

    it("fails closed when CLIENT_IP_HEADER is configured but missing, instead of trusting X-Forwarded-For", () => {
        vi.stubEnv("CLIENT_IP_HEADER", "cf-connecting-ip");
        expect(getClientIp(requestWith({ "x-forwarded-for": "6.6.6.6" }))).toBe("unknown");
    });
});

describe("rateLimitKey", () => {
    it("keeps IPv4 addresses whole", () => {
        expect(rateLimitKey("203.0.113.7")).toBe("203.0.113.7");
    });

    it("buckets IPv6 addresses by /64, so one allocation can't rotate through fresh keys", () => {
        expect(rateLimitKey("2001:db8:aa:bb:1:2:3:4")).toBe("2001:db8:aa:bb::/64");
        expect(rateLimitKey("2001:db8:aa:bb::9")).toBe("2001:db8:aa:bb::/64");
        expect(rateLimitKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    });

    it("passes through non-IP keys such as unknown", () => {
        expect(rateLimitKey("unknown")).toBe("unknown");
    });
});
