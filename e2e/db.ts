import { hash } from "bcrypt";
import mongoose, { Types, type Connection } from "mongoose";
import { PASSWORD } from "./fixtures";

// Same default as playwright.config.ts; never MONGODB_URI, which may point at a real database.
export const E2E_MONGODB_URI = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/blog_e2e";
if (!new URL(E2E_MONGODB_URI).pathname.endsWith("_e2e")) {
    throw new Error(`Refusing to touch "${E2E_MONGODB_URI}": the e2e database name must end in "_e2e".`);
}

// Direct access to the e2e database, for arranging data and checking what the app stored.
export async function withDb<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    const connection = await mongoose.createConnection(E2E_MONGODB_URI).asPromise();
    try {
        return await fn(connection);
    } finally {
        await connection.close();
    }
}

// A fresh, verified account for tests that change it (role, password, deletion), so the seeded users stay intact.
export async function createUser(username: string, role = "reader"): Promise<{ id: Types.ObjectId; email: string; username: string }> {
    const id = new Types.ObjectId();
    const email = `${username.replace(/\W/g, "-")}@example.com`;
    const now = new Date();
    await withDb(async (db) => db.collection("users").insertOne({
        _id: id, username, email, firstName: "Temp", lastName: "E2E", role, password: await hash(PASSWORD, 10),
        upvoteCount: 0, downvoteCount: 0, createdAt: now, updatedAt: now,
    }));
    return { id, email, username };
}
