// Downloads this month's DB-IP "IP to City Lite" database (CC BY 4.0, attribution on the privacy page)
// to GEOIP_DB_PATH, or data/geoip/dbip-city-lite.mmdb. Run monthly; DB-IP publishes on the 1st.
import { createWriteStream } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";

async function download() {
    const target = resolve(process.env.GEOIP_DB_PATH || "data/geoip/dbip-city-lite.mmdb");
    const month = new Date().toISOString().slice(0, 7);
    const url = `https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz`;
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}): ${url}`);
    await mkdir(dirname(target), { recursive: true });
    // Written beside the target first, so a failed download never replaces a working database.
    const partial = `${target}.partial`;
    await pipeline(Readable.fromWeb(response.body as import("node:stream/web").ReadableStream), createGunzip(), createWriteStream(partial));
    await rename(partial, target);
    console.log(`Saved ${url} to ${target}`);
}

download().catch((error) => {
    console.error(error);
    process.exit(1);
});
