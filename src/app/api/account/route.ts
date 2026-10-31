import { NextResponse } from "next/server";
import { compare } from "bcrypt";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import { deleteAccount, isLastAdmin } from "@/libs/account-data";
import { ROLES } from "@/libs/roles";

// Admin deletions run one at a time, so two admins deleting at once can't both pass the last-admin check
// (in-process lock: the app runs as a single instance, see docs/roadmap.md).
let adminDeletions: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
    const run = adminDeletions.then(task, task);
    adminDeletions = run.catch(() => {});
    return run;
}

// Permanently deletes the signed-in account after re-checking its password (D-09).
export const DELETE = withApiGuard(async (request, { session }) => {
    const body = await request.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";
    const user = await User.findById(session.user.id).select("password role").lean<{ password?: string; role: string }>();
    if (!user) return NextResponse.json({ data: null, message: "Account not found" }, { status: 404 });

    if (!password || !user.password || !(await compare(password, user.password))) {
        return NextResponse.json({ data: null, message: "That password isn't correct." }, { status: 403 });
    }
    const remove = async () => {
        if (await isLastAdmin(session.user.id, user.role)) {
            return NextResponse.json({ data: null, message: "You're the only admin. Make someone else an admin before deleting your account." }, { status: 409 });
        }
        await deleteAccount(session.user.id);
        return NextResponse.json({ data: null, message: "Account deleted" });
    };
    return user.role === ROLES.ADMIN ? serialized(remove) : remove();
}, { rateLimit: { points: 5, duration: 15 * 60 } });
