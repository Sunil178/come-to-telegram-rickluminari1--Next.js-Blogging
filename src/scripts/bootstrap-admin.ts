import dbConnect from "@/libs/db-connect";
import User from "@/models/User";
import { ROLES } from "@/libs/roles";

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Usage: npm run bootstrap-admin -- <email>");
        process.exit(1);
    }

    await dbConnect();
    const result = await User.updateOne({ email }, { role: ROLES.ADMIN });
    if (result.matchedCount === 0) {
        console.error(`No user found with email: ${email}`);
        process.exit(1);
    }
    console.log(`✅ ${email} -> admin`);
    process.exit(0);
}

main();
