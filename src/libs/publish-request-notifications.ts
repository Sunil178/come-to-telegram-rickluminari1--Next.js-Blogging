import type { Types } from "mongoose";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { ROLES } from "@/libs/roles";
import { logger } from "@/libs/logger";

/**
 * Once a request to publish is reviewed, no admin's bell should keep showing it as waiting.
 * Best effort: the review itself has already succeeded.
 */
export async function markRequestNotificationsRead(requesterId: Types.ObjectId | string): Promise<void> {
    try {
        // Scoped to admins so the update uses the { recipientId, read } index.
        const adminIds = (await User.find({ role: ROLES.ADMIN }).select("_id").lean<{ _id: Types.ObjectId }[]>()).map((admin) => admin._id);
        await Notification.updateMany(
            { recipientId: { $in: adminIds }, read: false, type: "publish_request", actorId: requesterId },
            { $set: { read: true, readAt: new Date() } }
        );
    } catch (error) {
        logger.warn("Failed to mark publish-request notifications read", { error });
    }
}
