import { NextResponse } from "next/server";
import ContactMessage from "@/models/ContactMessage";
import { withApiGuard } from "@/libs/api-guard";
import { logger } from "@/libs/logger";
import { ROLES } from "@/libs/roles";

type RouteContext = { params: Promise<{ id: string }> };

// Admins mark a message resolved once they've answered it, or reopen it.
export const PATCH = withApiGuard<RouteContext>(
    async (request, { params, session }) => {
        try {
            const { id } = await params;
            const body = await request.json().catch(() => null);
            const status = body?.status;
            if (status !== "open" && status !== "resolved") {
                return NextResponse.json({ data: null, message: "Status must be open or resolved" }, { status: 400 });
            }
            const update = status === "resolved" ? { status, resolvedAt: new Date(), resolvedBy: session.user.id } : { status, resolvedAt: null, resolvedBy: null };
            const message = await ContactMessage.findByIdAndUpdate(id, { $set: update }, { new: true }).select("status").lean();
            if (!message) return NextResponse.json({ data: null, message: "Message not found" }, { status: 404 });
            return NextResponse.json({ data: { status }, message: "Success" });
        } catch (error) {
            logger.error("Failed to update a contact message", { error });
            return NextResponse.json({ data: null, message: "Couldn't update the message" }, { status: 500 });
        }
    },
    { role: ROLES.ADMIN, objectIdParams: ["id"] }
);
