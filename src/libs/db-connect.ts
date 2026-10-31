import mongoose from "mongoose";
import { logger } from "@/libs/logger";

// Don't call this from routes/pages/components — `src/instrumentation-node.ts` already
// calls it once when the server boots, and mongoose's default connection is shared
// process-wide after that. The only other legitimate caller is `src/seeds/seeder.ts`,
// a standalone script that runs outside the Next.js server (instrumentation never fires
// for it).
const MONGODB_URI = process.env.MONGODB_URI
const requestedPoolSize = Number(process.env.MONGODB_POOL_SIZE)
const POOL_SIZE = Number.isInteger(requestedPoolSize) && requestedPoolSize > 0 ? requestedPoolSize : 10

if (!MONGODB_URI) {
    logger.error("Please define the MONGODB_URI environment variable inside .env")
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null }
}

async function dbConnect() {
    if (cached.conn) {
        logger.debug("Using cached DB connection");
        return cached.conn
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            // A fixed-size pool, filled in the background from boot: a socket the driver opens on demand inherits the
            // async context of the request that needed it (Node 24 AsyncContextFrame), which then keeps every later
            // request in memory. This keeps on-demand opens to the rare cases (a request in the first moments after
            // boot, a connection replaced after a network error) instead of every pool growth under load.
            minPoolSize: POOL_SIZE,
            maxPoolSize: POOL_SIZE,
        }
        cached.promise = mongoose.connect(MONGODB_URI!, opts).then(mongoose => {
            logger.info("New MongoDB connection established");
            return mongoose
        })
    }
    cached.conn = await cached.promise
    return cached.conn
}

export default dbConnect
