import { afterEach, describe, expect, it, vi } from "vitest";
import { commentsEnabled, featureEnabled, signupEnabled } from "@/libs/runtime-config";

describe("featureEnabled", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("is on when the variable is unset or empty", () => {
        vi.stubEnv("SOME_FEATURE", "");
        expect(featureEnabled("SOME_FEATURE")).toBe(true);
    });

    it.each(["false", "FALSE", "0", "off", "no", " false "])("is off for %j", (value) => {
        vi.stubEnv("SOME_FEATURE", value);
        expect(featureEnabled("SOME_FEATURE")).toBe(false);
    });

    it.each(["true", "1", "on", "yes"])("is on for %j", (value) => {
        vi.stubEnv("SOME_FEATURE", value);
        expect(featureEnabled("SOME_FEATURE")).toBe(true);
    });

    it("reads SIGNUP_ENABLED and COMMENTS_ENABLED", () => {
        vi.stubEnv("SIGNUP_ENABLED", "false");
        vi.stubEnv("COMMENTS_ENABLED", "true");
        expect(signupEnabled()).toBe(false);
        expect(commentsEnabled()).toBe(true);
    });
});
