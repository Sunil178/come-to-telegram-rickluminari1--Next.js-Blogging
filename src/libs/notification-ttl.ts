import mongoose from "mongoose";
import Notification from "@/models/Notification";
import { logger } from "@/libs/logger";

const INDEX_NAME = "readAt_ttl";
const DEFAULT_DAYS = 90;
// MongoDB caps expireAfterSeconds at 2^31 - 1 (about 68 years). Below an hour is treated as a mistake:
// a tiny value would round to 0 seconds and delete notifications as soon as they're read.
const MAX_DAYS = Math.floor(2147483647 / 86400);
const MIN_DAYS = 1 / 24;

// NOTIFICATION_READ_TTL_DAYS: days a read notification is kept (default 90); 0 keeps them forever.
export function readTtlDays(): number {
    const raw = process.env.NOTIFICATION_READ_TTL_DAYS;
    if (raw === undefined || raw.trim() === "") return DEFAULT_DAYS;
    const days = Number(raw);
    if (!Number.isFinite(days) || days < 0 || (days > 0 && days < MIN_DAYS)) {
        logger.warn("Ignoring invalid NOTIFICATION_READ_TTL_DAYS", { value: raw, fallback: DEFAULT_DAYS });
        return DEFAULT_DAYS;
    }
    return Math.min(days, MAX_DAYS);
}

const NAMESPACE_NOT_FOUND = 26;

// Runs at server boot without blocking it. The index lives outside the schema because Mongoose can't
// change an existing index's expireAfterSeconds; collMod can, so a new value applies on the next restart.
export async function syncNotificationReadTtl(days = readTtlDays()): Promise<void> {
    try {
        const collection = Notification.collection;
        const indexes = await collection.indexes().catch((error: { code?: number }) => {
            if (error.code === NAMESPACE_NOT_FOUND) return []; // fresh database: nothing to inspect yet
            throw error;
        });
        const existing = indexes.find((index) => index.name === INDEX_NAME);

        if (days === 0) {
            if (existing) await collection.dropIndex(INDEX_NAME);
            logger.info("Read notifications are kept indefinitely (NOTIFICATION_READ_TTL_DAYS=0)");
            return;
        }

        const seconds = Math.round(days * 86400);
        if (!existing) {
            await collection.createIndex({ readAt: 1 }, { name: INDEX_NAME, expireAfterSeconds: seconds });
            // Once, when the index first appears: rows read before readAt existed start their clock now.
            // Dedupe records are skipped; they keep repeat upvotes silent and must not expire.
            await Notification.updateMany({ read: true, readAt: null, dedupe: { $ne: true } }, { $set: { readAt: new Date() } });
        } else if (existing.expireAfterSeconds !== seconds) {
            await mongoose.connection.db!.command({ collMod: collection.collectionName, index: { name: INDEX_NAME, expireAfterSeconds: seconds } });
        }
        logger.info("Read notifications expire after the configured TTL", { days });
    } catch (error) {
        logger.error("Failed to sync the read-notification TTL index", { error });
    }
}
