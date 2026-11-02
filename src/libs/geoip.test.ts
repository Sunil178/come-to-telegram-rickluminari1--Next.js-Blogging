import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatLocation, lookupLocation, resetGeoipReaderForTests } from "@/libs/geoip";

const DB = "data/geoip/dbip-city-lite.mmdb";

describe("lookupLocation", () => {
    afterEach(() => {
        delete process.env.GEOIP_DB_PATH;
        resetGeoipReaderForTests();
        vi.useRealTimers();
    });

    it("is off without a database, and for addresses that aren't IPs", async () => {
        expect(await lookupLocation("8.8.8.8")).toBeNull();
        process.env.GEOIP_DB_PATH = "/nonexistent/geo.mmdb";
        expect(await lookupLocation("8.8.8.8")).toBeNull();
        expect(await lookupLocation("unknown")).toBeNull();
    });

    // Needs the downloaded database (npm run geoip:download); skipped where it isn't present, such as CI.
    it.skipIf(!existsSync(DB))("locates public IPv4 and IPv6 addresses and returns nothing for private ones", async () => {
        process.env.GEOIP_DB_PATH = DB;
        expect((await lookupLocation("8.8.8.8"))?.countryCode).toBe("US");
        expect((await lookupLocation("2a00:1450:4001:80b::200e"))?.countryCode).toBeTruthy();
        expect(await lookupLocation("127.0.0.1")).toBeNull();
        expect(await lookupLocation("192.168.1.10")).toBeNull();
    });
});

describe("lookupLocation retries", () => {
    afterEach(() => {
        delete process.env.GEOIP_DB_PATH;
        resetGeoipReaderForTests();
        vi.useRealTimers();
    });

    // The server can start before the monthly download has put the file in place.
    it.skipIf(!existsSync(DB))("opens the database once it appears, a few minutes after a failed attempt", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        process.env.GEOIP_DB_PATH = "/nonexistent/geo.mmdb";
        expect(await lookupLocation("8.8.8.8")).toBeNull();
        process.env.GEOIP_DB_PATH = DB;
        expect(await lookupLocation("8.8.8.8")).toBeNull();
        vi.setSystemTime(Date.now() + 6 * 60 * 1000);
        expect((await lookupLocation("8.8.8.8"))?.countryCode).toBe("US");
    });
});

describe("formatLocation", () => {
    it("joins the known parts and says when nothing is known", () => {
        expect(formatLocation({ country: "India", countryCode: "IN", region: "Karnataka", city: "Bengaluru" })).toBe("Bengaluru, Karnataka, India");
        expect(formatLocation({ country: "India", countryCode: "IN", region: null, city: null })).toBe("India");
        expect(formatLocation(null)).toBe("Unknown location");
    });
});
