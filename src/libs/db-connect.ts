import mongoose from "mongoose";

// Don't call this from routes/pages/components — `src/instrumentation-node.ts` already
// calls it once when the server boots, and mongoose's default connection is shared
// process-wide after that. The only other legitimate caller is `src/seeds/seeder.ts`,
// a standalone script that runs outside the Next.js server (instrumentation never fires
// for it).
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
    console.error('Please define the MONGODB_URI environment variable inside .env')
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
        console.log('Using cached DB connection');
        return cached.conn
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
        }
        cached.promise = mongoose.connect(MONGODB_URI!, opts).then(mongoose => {
            console.log('New MongoDB connection established');
            return mongoose
        })
    }
    cached.conn = await cached.promise
    return cached.conn
}

export default dbConnect
