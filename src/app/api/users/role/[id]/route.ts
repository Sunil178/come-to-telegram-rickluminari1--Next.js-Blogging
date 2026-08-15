import { NextResponse } from "next/server";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import { ROLE_RANK } from "@/libs/roles";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(
    async (request, { params, session }) => {
        try {
            const { id } = await params;
            const body = await request.json().catch(() => null);
            const role = body?.role;

            if (!Object.keys(ROLE_RANK).includes(role)) {
                return NextResponse.json({ data: null, message: "Invalid role" }, { status: 400 });
            }

            if (id === session.user.id) {
                return NextResponse.json({ data: null, message: "You can't change your own role" }, { status: 400 });
            }

            const target = await User.findById(id).select("role");
            if (target?.role === "admin" && role !== "admin") {
                const adminCount = await User.countDocuments({ role: "admin" });
                if (adminCount === 1) {
                    return NextResponse.json({ data: null, message: "Can't demote the last remaining admin" }, { status: 400 });
                }
            }

            const user = await User.findOneAndUpdate({ _id: id }, { role }, { new: true });
            if (!user) {
                return NextResponse.json({ data: null, message: "User not found" }, { status: 404 });
            }

            return NextResponse.json({ data: { id: user._id.toString(), role: user.role }, message: "Success" });
        } catch (error) {
            console.error("Failed to update user role:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "admin" }
);
