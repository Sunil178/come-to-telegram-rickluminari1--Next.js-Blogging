import type { Types } from "mongoose";

export interface FlatComment {
    _id: Types.ObjectId | string;
    postId: Types.ObjectId | string;
    parentId: Types.ObjectId | string | null;
    userId: { _id: Types.ObjectId | string; username?: string } | Types.ObjectId | string | null;
    content: string;
    upvoteCount: number;
    downvoteCount: number;
    editedAt: Date | string | null;
    deleted?: boolean;
    createdAt: Date | string;
}

export interface CommentNode {
    id: string;
    parentId: string | null;
    content: string;
    authorId: string | null;
    authorUsername: string | null;
    upvoteCount: number;
    downvoteCount: number;
    editedAt: string | null;
    createdAt: string;
    deleted: boolean;
    replies: CommentNode[];
}

/**
 * Builds a nested reply tree from a flat, parentId-linked comment list.
 * A soft-deleted comment with no surviving replies is dropped entirely;
 * one with replies is kept as a "[deleted]" placeholder (content cleared,
 * deleted: true) so the thread structure under it stays intact.
 */
export function buildCommentTree(flat: FlatComment[]): CommentNode[] {
    const byId = new Map<string, CommentNode>();
    const childrenOf = new Map<string, string[]>();

    for (const comment of flat) {
        const id = comment._id.toString();
        const author =
            comment.userId && typeof comment.userId === "object" && "username" in comment.userId
                ? comment.userId
                : null;

        byId.set(id, {
            id,
            parentId: comment.parentId ? comment.parentId.toString() : null,
            content: comment.deleted ? "" : comment.content,
            authorId: author?._id ? author._id.toString() : null,
            authorUsername: author?.username ?? null,
            upvoteCount: comment.upvoteCount ?? 0,
            downvoteCount: comment.downvoteCount ?? 0,
            editedAt: comment.editedAt ? new Date(comment.editedAt).toISOString() : null,
            createdAt: new Date(comment.createdAt).toISOString(),
            deleted: Boolean(comment.deleted),
            replies: [],
        });

        const parentKey = comment.parentId ? comment.parentId.toString() : "root";
        const siblings = childrenOf.get(parentKey) ?? [];
        siblings.push(id);
        childrenOf.set(parentKey, siblings);
    }

    function attachChildren(id: string): CommentNode {
        const node = byId.get(id)!;
        const childIds = childrenOf.get(id) ?? [];
        node.replies = childIds.map(attachChildren);
        return node;
    }

    const roots = (childrenOf.get("root") ?? []).map(attachChildren);

    return pruneDeletedLeaves(roots);
}

function pruneDeletedLeaves(nodes: CommentNode[]): CommentNode[] {
    const kept: CommentNode[] = [];
    for (const node of nodes) {
        node.replies = pruneDeletedLeaves(node.replies);
        if (node.deleted && node.replies.length === 0) continue;
        kept.push(node);
    }
    return kept;
}
