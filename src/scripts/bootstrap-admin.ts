import { MongoClient } from "mongodb";

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Usage: npm run bootstrap-admin -- <email>");
        process.exit(1);
    }

    const client = new MongoClient(process.env.MONGODB_URI as string);
    try {
        await client.connect();
        const db = client.db();
        const result = await db.collection("users").updateOne({ email }, { $set: { role: "admin" } });
        if (result.matchedCount === 0) {
            console.error(`No user found with email: ${email}`);
            process.exit(1);
        }
        console.log(`✅ ${email} -> admin`);
    } finally {
        await client.close();
    }
}

main();
