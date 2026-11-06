// No model import: route tests mock "@/models/Post", and this stays usable anywhere.
const APPROVED = "Approved";

// The one definition of "readers can see this post": approved, published, visible, and its publish
// time reached. Scheduled posts (publishedAt in the future) stay hidden until then, with no scheduler.
export function publicPostFilter(now: Date = new Date()) {
    return {
        approval: APPROVED,
        published: true,
        visibility: true,
        publishedAt: { $lte: now },
    };
}

interface VisibilityFields {
    approval?: string;
    published?: boolean;
    visibility?: boolean;
    publishedAt?: Date | string | null;
}

// A private post (visibility false) belongs to its author alone: moderators and admins don't see,
// review, edit or delete it, and it never reaches readers, even if it was approved earlier.
export const SHARED_POST = { visibility: true } as const;

// The posts a user can edit or delete: their own, plus every shared post for admins.
export function manageablePostFilter(userId: string, isAdmin: boolean) {
    return isAdmin ? { $or: [{ visibility: true }, { userId }] } : { userId };
}

export function isPubliclyVisible(post: VisibilityFields, now: Date = new Date()): boolean {
    return (
        post.approval === APPROVED &&
        Boolean(post.published) &&
        Boolean(post.visibility) &&
        post.publishedAt != null &&
        new Date(post.publishedAt).getTime() <= now.getTime()
    );
}

export function isScheduled(post: VisibilityFields, now: Date = new Date()): boolean {
    return (
        post.approval === APPROVED &&
        Boolean(post.published) &&
        Boolean(post.visibility) &&
        post.publishedAt != null &&
        new Date(post.publishedAt).getTime() > now.getTime()
    );
}
