import { NextResponse } from "next/server";
import { withApiGuard } from "@/libs/api-guard";
import { exportAccountData } from "@/libs/account-data";

// "Download my data": everything stored about the signed-in user, as a JSON file.
export const GET = withApiGuard(async (_request, { session }) => {
    const data = await exportAccountData(session.user.id);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Disposition": `attachment; filename="vedev-account-${date}.json"`,
            "Cache-Control": "no-store",
        },
    });
}, { rateLimit: { points: 5, duration: 60 * 60 } });
