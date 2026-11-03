import { describe, expect, it } from "vitest";
import User from "@/models/User";

describe("User model", () => {
    it("starts an account unverified unless its creator records the verification", () => {
        expect(new User({ username: "u", email: "u@example.com" }).emailVerifiedAt).toBeNull();
    });
});
