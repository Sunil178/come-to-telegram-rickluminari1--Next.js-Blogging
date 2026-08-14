"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CommentNode } from "@/libs/comment-tree";
import { loginRedirectUrl } from "@/libs/auth-redirect";
import CommentForm from "@/components/comments/CommentForm";
import CommentItem from "@/components/comments/CommentItem";

interface CommentSectionProps {
    postSlug: string;
    initialComments: CommentNode[];
    isLoggedIn: boolean;
    currentUserId: string | null;
    currentUsername: string | null;
}

type CommentAction =
    | { kind: "add"; node: CommentNode }
    | { kind: "edit"; id: string; content: string; editedAt: string }
    | { kind: "remove"; id: string };

function mapTree(nodes: CommentNode[], id: string, fn: (node: CommentNode) => CommentNode): CommentNode[] {
    return nodes.map((node) => {
        if (node.id === id) return fn(node);
        if (node.replies.length === 0) return node;
        return { ...node, replies: mapTree(node.replies, id, fn) };
    });
}

function insertReply(nodes: CommentNode[], parentId: string | null, node: CommentNode): CommentNode[] {
    if (parentId === null) return [...nodes, node];
    return nodes.map((existing) => {
        if (existing.id === parentId) {
            return { ...existing, replies: [...existing.replies, node] };
        }
        if (existing.replies.length === 0) return existing;
        return { ...existing, replies: insertReply(existing.replies, parentId, node) };
    });
}

function removeComment(nodes: CommentNode[], id: string): CommentNode[] {
    const next: CommentNode[] = [];
    for (const node of nodes) {
        if (node.id === id) {
            if (node.replies.length > 0) {
                next.push({ ...node, content: "", deleted: true });
            }
            continue;
        }
        next.push({ ...node, replies: removeComment(node.replies, id) });
    }
    return next;
}

function countComments(nodes: CommentNode[]): number {
    return nodes.reduce((sum, node) => sum + 1 + countComments(node.replies), 0);
}

function reduceComments(state: CommentNode[], action: CommentAction): CommentNode[] {
    switch (action.kind) {
        case "add":
            return insertReply(state, action.node.parentId, action.node);
        case "edit":
            return mapTree(state, action.id, (node) => ({ ...node, content: action.content, editedAt: action.editedAt }));
        case "remove":
            return removeComment(state, action.id);
        default:
            return state;
    }
}

export default function CommentSection({
    postSlug,
    initialComments,
    isLoggedIn,
    currentUserId,
    currentUsername,
}: CommentSectionProps) {
    const router = useRouter();
    const [comments, setComments] = useState(initialComments);
    const [optimisticComments, applyOptimistic] = useOptimistic(comments, reduceComments);
    const [, startTransition] = useTransition();

    const requireLogin = () => {
        router.push(loginRedirectUrl(location.pathname));
    };

    const handleAdd = (content: string, parentId: string | null) => {
        if (!isLoggedIn || !currentUserId) {
            requireLogin();
            return;
        }
        const tempId = `temp-${Date.now()}`;
        const optimisticNode: CommentNode = {
            id: tempId,
            parentId,
            content,
            authorId: currentUserId,
            authorUsername: currentUsername,
            upvoteCount: 0,
            downvoteCount: 0,
            myVote: null,
            editedAt: null,
            createdAt: new Date().toISOString(),
            deleted: false,
            replies: [],
        };

        startTransition(async () => {
            applyOptimistic({ kind: "add", node: optimisticNode });
            try {
                const response = await fetch(`/api/posts/${postSlug}/comments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content, parentId }),
                });
                if (response.status === 401) {
                    requireLogin();
                    return;
                }
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to post comment.");
                    return;
                }
                setComments((prev) =>
                    insertReply(removeComment(prev, tempId), parentId, {
                        ...optimisticNode,
                        id: result.data.id,
                        createdAt: result.data.createdAt,
                    })
                );
            } catch {
                toast.error("Failed to post comment.");
            }
        });
    };

    const handleEdit = (id: string, content: string) => {
        startTransition(async () => {
            const editedAt = new Date().toISOString();
            applyOptimistic({ kind: "edit", id, content, editedAt });
            try {
                const response = await fetch(`/api/comments/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content }),
                });
                if (response.status === 401) {
                    requireLogin();
                    return;
                }
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to update comment.");
                    return;
                }
                setComments((prev) =>
                    mapTree(prev, id, (node) => ({ ...node, content: result.data.content, editedAt: result.data.editedAt }))
                );
            } catch {
                toast.error("Failed to update comment.");
            }
        });
    };

    const handleDelete = (id: string) => {
        startTransition(async () => {
            applyOptimistic({ kind: "remove", id });
            try {
                const response = await fetch(`/api/comments/${id}`, { method: "DELETE" });
                if (response.status === 401) {
                    requireLogin();
                    return;
                }
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to delete comment.");
                    return;
                }
                setComments((prev) => removeComment(prev, id));
            } catch {
                toast.error("Failed to delete comment.");
            }
        });
    };

    return (
        <section className="mx-auto mt-16 max-w-3xl px-6">
            <h2 className="font-heading text-2xl font-semibold text-foreground">
                Comments{" "}
                {countComments(optimisticComments) > 0 && (
                    <span className="text-muted-foreground">({countComments(optimisticComments)})</span>
                )}
            </h2>

            <div className="mt-6">
                <CommentForm isLoggedIn={isLoggedIn} onSubmit={(content) => handleAdd(content, null)} />
            </div>

            <div className="mt-8 space-y-6">
                {optimisticComments.map((node) => (
                    <CommentItem
                        key={node.id}
                        node={node}
                        currentUserId={currentUserId}
                        isLoggedIn={isLoggedIn}
                        onReply={(content, parentId) => handleAdd(content, parentId)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                ))}
                {optimisticComments.length === 0 && (
                    <p className="text-sm text-muted-foreground">No comments yet — be the first to share your thoughts.</p>
                )}
            </div>
        </section>
    );
}
