import { isIP } from "node:net";
import maxmind, { type CityResponse, type Reader } from "maxmind";
import { logger } from "@/libs/logger";

export interface IpLocation {
    country: string | null;
    countryCode: string | null;
    region: string | null;
    city: string | null;
}

/** An address the app saw, with its approximate location when the geolocation database knows it. */
export interface IpRecord {
    ip: string;
    location: IpLocation | null;
    at: Date;
}

// Opened once per process on first use; a missing or unreadable file turns lookups off (they return null).
let reader: Promise<Reader<CityResponse> | null> | null = null;

function openReader(): Promise<Reader<CityResponse> | null> {
    const path = process.env.GEOIP_DB_PATH;
    if (!path) return Promise.resolve(null);
    // watchForUpdates reloads the file after the monthly `npm run geoip:download`, without a restart.
    return maxmind.open<CityResponse>(path, { watchForUpdates: true, watchForUpdatesNonPersistent: true }).catch((error) => {
        logger.warn("IP geolocation database could not be opened; locations are off", { path, error });
        return null;
    });
}

/** Approximate location of a public IP address from the offline DB-IP Lite database (GEOIP_DB_PATH). */
export async function lookupLocation(ip: string): Promise<IpLocation | null> {
    if (!isIP(ip)) return null;
    reader ??= openReader();
    const db = await reader;
    if (!db) return null;
    try {
        const result = db.get(ip);
        if (!result) return null;
        return {
            country: result.country?.names?.en ?? null,
            countryCode: result.country?.iso_code ?? null,
            region: result.subdivisions?.[0]?.names?.en ?? null,
            city: result.city?.names?.en ?? null,
        };
    } catch (error) {
        logger.warn("IP geolocation lookup failed", { error });
        return null;
    }
}

export async function ipRecord(ip: string): Promise<IpRecord> {
    return { ip, location: await lookupLocation(ip), at: new Date() };
}

export function formatLocation(location: IpLocation | null | undefined): string {
    if (!location) return "Unknown location";
    return [location.city, location.region, location.country].filter(Boolean).join(", ") || "Unknown location";
}

// Tests swap databases between cases.
export function resetGeoipReaderForTests() {
    reader = null;
}
