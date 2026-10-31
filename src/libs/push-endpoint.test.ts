import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "@/libs/push-endpoint";

describe("isAllowedPushEndpoint", () => {
    it("accepts the browsers' push services over https", () => {
        expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
        expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
        expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);
        expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    });

    it("rejects non-https, internal, and look-alike hosts", () => {
        expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
        expect(isAllowedPushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
        expect(isAllowedPushEndpoint("https://localhost:27017/")).toBe(false);
        expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
        expect(isAllowedPushEndpoint("https://evilnotify.windows.com/x")).toBe(false);
        expect(isAllowedPushEndpoint("https://user@fcm.googleapis.com:8443/x")).toBe(false);
    });

    it("rejects malformed and oversized input", () => {
        expect(isAllowedPushEndpoint("not a url")).toBe(false);
        expect(isAllowedPushEndpoint(`https://fcm.googleapis.com/${"a".repeat(2100)}`)).toBe(false);
    });
});
