import VisitorEvent from "@/models/VisitorEvent";
import { logger } from "@/libs/logger";

// All three never throw: interest tracking must not break page views, sign-in or consent changes.

export async function recordPostView(event: { visitorId: string; userId: string | null; postId: string }): Promise<void> {
    try {
        await VisitorEvent.create({ ...event, type: "post_view" });
    } catch (error) {
        logger.error("Failed to record a visitor event", { error });
    }
}

// Attaches a visitor's anonymous events to the account they just signed into or created.
export async function stitchVisitor(visitorId: string, userId: string): Promise<void> {
    try {
        await VisitorEvent.updateMany({ visitorId, userId: null }, { $set: { userId } });
    } catch (error) {
        logger.error("Failed to stitch visitor events", { error });
    }
}

// Consent withdrawn: the visitor's anonymous events go with it.
export async function forgetVisitor(visitorId: string): Promise<void> {
    try {
        await VisitorEvent.deleteMany({ visitorId, userId: null });
    } catch (error) {
        logger.error("Failed to delete visitor events", { error });
    }
}
