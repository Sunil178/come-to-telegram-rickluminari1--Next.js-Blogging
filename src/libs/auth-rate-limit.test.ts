import { describe, expect, it } from "vitest";
import { beginLoginAttempt, consumeRegistrationAttempt, recordLoginSuccess } from "@/libs/auth-rate-limit";

describe("login rate limiting", () => {
    it("blocks an account from one IP after 5 attempts, without locking the owner out from another IP", async () => {
        for (let i = 0; i < 5; i++) expect(await beginLoginAttempt("10.1.0.1", "victim@example.com")).toBe(true);
        expect(await beginLoginAttempt("10.1.0.1", "victim@example.com")).toBe(false);
        expect(await beginLoginAttempt("10.1.0.2", "victim@example.com")).toBe(true);
    });

    it("blocks an account after 50 attempts spread across many IPs", async () => {
        for (let i = 0; i < 50; i++) expect(await beginLoginAttempt(`10.2.${i}.1`, "target@example.com")).toBe(true);
        expect(await beginLoginAttempt("10.2.200.1", "target@example.com")).toBe(false);
    });

    it("reserves attempts before the password check, so concurrent guesses can't exceed the limit", async () => {
        const results = await Promise.all(Array.from({ length: 10 }, () => beginLoginAttempt("10.3.0.1", "race@example.com")));
        expect(results.filter(Boolean)).toHaveLength(5);
    });

    it("refunds a successful login, so it doesn't count against the IP or the account", async () => {
        for (let i = 0; i < 30; i++) {
            expect(await beginLoginAttempt("10.4.0.1", "regular@example.com")).toBe(true);
            await recordLoginSuccess("10.4.0.1", "regular@example.com");
        }
    });

    it("blocks an IP after 20 failed attempts across any accounts", async () => {
        for (let i = 0; i < 20; i++) expect(await beginLoginAttempt("10.5.0.1", `user${i}@example.com`)).toBe(true);
        expect(await beginLoginAttempt("10.5.0.1", "another@example.com")).toBe(false);
    });

    it("treats account keys case-insensitively", async () => {
        for (let i = 0; i < 5; i++) await beginLoginAttempt("10.6.0.1", "Mixed@Example.com");
        expect(await beginLoginAttempt("10.6.0.1", "mixed@example.com")).toBe(false);
    });
});

describe("registration rate limiting", () => {
    it("allows 10 registration attempts per IP per hour, then blocks", async () => {
        for (let i = 0; i < 10; i++) expect(await consumeRegistrationAttempt("10.7.0.1")).toBe(true);
        expect(await consumeRegistrationAttempt("10.7.0.1")).toBe(false);
        expect(await consumeRegistrationAttempt("10.7.0.2")).toBe(true);
    });
});
