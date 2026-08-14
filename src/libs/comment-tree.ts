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
    myVote?: boolean | null;
    editedAt: string | null;
    createdAt: string;
    deleted: boolean;
    replies: CommentNode[];
}

function extractAuthorId(userId: FlatComment["userId"]): string | null {
    if (!userId) return null;
    if (typeof userId === "object" && "username" in userId) {
        return userId._id ? userId._id.toString() : null;
    }
    return userId.toString();
}

function extractAuthorUsername(userId: FlatComment["userId"]): string | null {
    if (userId && typeof userId === "object" && "username" in userId) {
        return userId.username ?? null;
    }
    return null;
}

/**
 * Builds a nested reply tree from a flat, parentId-linked comment list.
 * A soft-deleted comment with no surviving replies is dropped entirely;
 * one with replies is kept as a "[deleted]" placeholder (content cleared,
 * deleted: true) so the thread structure under it stays intact.
 */
export function buildCommentTree(flat: FlatComment[], myVotes: Map<string, boolean> = new Map()): CommentNode[] {
    const byId = new Map<string, CommentNode>();
    const childrenOf = new Map<string, string[]>();

    for (const comment of flat) {
        const id = comment._id.toString();

        byId.set(id, {
            id,
            parentId: comment.parentId ? comment.parentId.toString() : null,
            content: comment.deleted ? "" : comment.content,
            authorId: extractAuthorId(comment.userId),
            authorUsername: extractAuthorUsername(comment.userId),
            upvoteCount: comment.upvoteCount ?? 0,
            downvoteCount: comment.downvoteCount ?? 0,
            myVote: myVotes.get(id) ?? null,
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
