// No model import: route tests mock "@/models/Post", and this stays usable anywhere.
const APPROVED = "Approved";

// The one definition of "readers can see this post": approved, published, visible, and its publish
// time reached. Scheduled posts (publishedAt in the future) stay hidden until then, with no scheduler.
// A missing publishedAt (posts approved by older code) counts as published.
export function publicPostFilter(now: Date = new Date()) {
    return {
        approval: APPROVED,
        published: true,
        visibility: true,
        publishedAt: { $not: { $gt: now } },
    };
}

interface VisibilityFields {
    approval?: string;
    published?: boolean;
    visibility?: boolean;
    publishedAt?: Date | string | null;
}

export function isPubliclyVisible(post: VisibilityFields, now: Date = new Date()): boolean {
    return (
        post.approval === APPROVED &&
        Boolean(post.published) &&
        Boolean(post.visibility) &&
        (post.publishedAt == null || new Date(post.publishedAt).getTime() <= now.getTime())
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
