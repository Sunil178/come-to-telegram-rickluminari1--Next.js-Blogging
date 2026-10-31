import { describe, expect, it } from "vitest";
import { consentedVisitorId, cookiesFromHeader, readConsent } from "@/libs/visitor";

const VID = "0b6f6d4e-2d4f-4c1a-9a51-8f2a5c3e7d10";

describe("visitor identity", () => {
    it("returns the visitor id only with granted consent and a well-formed id", () => {
        expect(consentedVisitorId(cookiesFromHeader(`consent=granted; vid=${VID}`))).toBe(VID);
        expect(consentedVisitorId(cookiesFromHeader(`vid=${VID}`))).toBeNull();
        expect(consentedVisitorId(cookiesFromHeader(`consent=denied; vid=${VID}`))).toBeNull();
        expect(consentedVisitorId(cookiesFromHeader("consent=granted; vid=not-a-uuid"))).toBeNull();
    });

    it("reads only known consent values", () => {
        expect(readConsent(cookiesFromHeader("consent=granted"))).toBe("granted");
        expect(readConsent(cookiesFromHeader("consent=maybe"))).toBeNull();
        expect(readConsent(cookiesFromHeader(null))).toBeNull();
    });
});
