import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUSH_SUBSCRIBE_TIMEOUT_MS, subscribeToPush } from "@/libs/push-subscription";

const subscribe = vi.fn();
const registration = { pushManager: { subscribe } };

describe("subscribeToPush", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal("window", { atob: (value: string) => Buffer.from(value, "base64").toString("binary"), PushManager: {} });
        vi.stubGlobal("navigator", { serviceWorker: { getRegistration: async () => registration, ready: Promise.resolve(registration) } });
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    // Some browsers never settle subscribe() (push service blocked or disabled), which would leave the toggle hanging.
    it("gives up when the browser's push service never answers", async () => {
        subscribe.mockReturnValue(new Promise(() => {}));
        const result = subscribeToPush("BAAA").catch((error: Error) => error);
        await vi.advanceTimersByTimeAsync(PUSH_SUBSCRIBE_TIMEOUT_MS);
        expect(await result).toBeInstanceOf(Error);
    });

    it("drops a subscription the browser delivers after the timeout, since it was never saved", async () => {
        let deliver: (value: unknown) => void = () => {};
        const unsubscribe = vi.fn(async () => true);
        subscribe.mockReturnValue(new Promise((resolve) => (deliver = resolve)));
        const result = subscribeToPush("BAAA").catch((error: Error) => error);
        await vi.advanceTimersByTimeAsync(PUSH_SUBSCRIBE_TIMEOUT_MS);
        await result;
        deliver({ unsubscribe });
        await vi.advanceTimersByTimeAsync(0);
        expect(unsubscribe).toHaveBeenCalled();
    });
});
