import type { Types } from "mongoose";
import Notification, { type NotificationType } from "@/models/Notification";
import User from "@/models/User";
import Post from "@/models/Post";
import { ROLES, ROLE_RANK, type RoleName } from "@/libs/roles";
import { notify } from "@/libs/notify";
import { logger } from "@/libs/logger";

type Id = Types.ObjectId | string;

// Everyone at or above the role: moderators review posts, admins also review publish requests.
async function staffIds(minimum: RoleName): Promise<Types.ObjectId[]> {
    const roles = (Object.keys(ROLE_RANK) as RoleName[]).filter((role) => ROLE_RANK[role] >= ROLE_RANK[minimum]);
    return (await User.find({ role: { $in: roles } }).select("_id").lean<{ _id: Types.ObjectId }[]>()).map((user) => user._id);
}

// Once something is reviewed, no reviewer's bell should keep showing it as waiting. Best effort: the review already succeeded.
async function markHandled(minimum: RoleName, filter: { type: NotificationType; actorId?: Id; postId?: Id }): Promise<void> {
    try {
        // Scoped to the reviewers so the update uses the { recipientId, read } index.
        const recipientIds = await staffIds(minimum);
        await Notification.updateMany({ recipientId: { $in: recipientIds }, read: false, ...filter }, { $set: { read: true, readAt: new Date() } });
    } catch (error) {
        logger.warn("Failed to mark review notifications read", { error, type: filter.type });
    }
}

export function markRequestNotificationsRead(requesterId: Id): Promise<void> {
    return markHandled(ROLES.ADMIN, { type: "publish_request", actorId: requesterId });
}

export function markPostReviewNotificationsRead(postId: Id): Promise<void> {
    return markHandled(ROLES.MODERATOR, { type: "post_submitted", postId });
}

// A private post belongs to its author alone, so staff lose even the notification that named it.
export async function removePostReviewNotifications(postId: Id): Promise<void> {
    try {
        await Notification.deleteMany({ type: "post_submitted", postId });
    } catch (error) {
        logger.warn("Failed to remove review notifications of a private post", { error });
    }
}

/** Tells every moderator and admin (except the author) that a post is waiting for review. */
export async function notifyPostSubmitted(post: { id: string; title: string; slug: string }, author: { id: string; username?: string | null }): Promise<void> {
    try {
        const recipients = await staffIds(ROLES.MODERATOR);
        await Promise.all(recipients.map((recipientId) =>
            notify({
                recipientId: recipientId.toString(),
                actorId: author.id,
                actorUsername: author.username,
                type: "post_submitted",
                postId: post.id,
                postTitle: post.title,
                postSlug: post.slug,
            })
        ));
        // A moderator may have reviewed (or the author deleted or made private) the post before these notifications existed.
        const current = await Post.findById(post.id).select("approval visibility").lean<{ approval: string; visibility: boolean }>();
        if (current?.visibility === false) await removePostReviewNotifications(post.id);
        else if (!current || current.approval !== "Pending") await markPostReviewNotificationsRead(post.id);
    } catch (error) {
        logger.error("Failed to notify moderators of a submitted post", { error });
    }
}
