"use client";

import { useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import VoteButtons from "@/components/votes/VoteButtons";
import CommentForm from "@/components/comments/CommentForm";
import type { CommentNode } from "@/libs/comment-tree";

interface CommentItemProps {
    node: CommentNode;
    currentUserId: string | null;
    isLoggedIn: boolean;
    onReply: (content: string, parentId: string) => void;
    onEdit: (id: string, content: string) => void;
    onDelete: (id: string) => void;
}

export default function CommentItem({ node, currentUserId, isLoggedIn, onReply, onEdit, onDelete }: CommentItemProps) {
    const [replying, setReplying] = useState(false);
    const [editing, setEditing] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [, startTransition] = useTransition();

    const isOwner = Boolean(currentUserId) && node.authorId === currentUserId;
    const isTempId = node.id.startsWith("temp-");

    const handleDelete = (event: MouseEvent) => {
        event.preventDefault();
        startTransition(() => {
            onDelete(node.id);
            setDeleteOpen(false);
        });
    };

    return (
        <div className="border-l-2 border-border pl-4">
            {node.deleted ? (
                <p className="text-sm text-muted-foreground italic">[deleted]</p>
            ) : (
                <>
                    <div className="flex items-center gap-2 text-sm">
                        {node.authorUsername ? (
                            <Link
                                href={`/users/${encodeURIComponent(node.authorUsername)}`}
                                className="font-medium text-foreground hover:text-teal"
                            >
                                {node.authorUsername}
                            </Link>
                        ) : (
                            <span className="font-medium text-foreground">Unknown</span>
                        )}
                        <span className="text-muted-foreground">
                            {new Date(node.createdAt).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                        {node.editedAt && <span className="text-xs text-muted-foreground">(edited)</span>}
                    </div>

                    {editing ? (
                        <div className="mt-2">
                            <CommentForm
                                isLoggedIn={isLoggedIn}
                                autoFocus
                                submitLabel="Save"
                                initialValue={node.content}
                                onCancel={() => setEditing(false)}
                                onSubmit={(content) => {
                                    onEdit(node.id, content);
                                    setEditing(false);
                                }}
                            />
                        </div>
                    ) : (
                        <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">{node.content}</p>
                    )}

                    {!isTempId && (
                        <div className="mt-2 flex items-center gap-3">
                            <VoteButtons
                                voteUrl={`/api/comments/${node.id}/vote`}
                                initialState={{
                                    upvoteCount: node.upvoteCount,
                                    downvoteCount: node.downvoteCount,
                                    myVote: node.myVote ?? null,
                                }}
                                isLoggedIn={isLoggedIn}
                                size="sm"
                            />
                            <Button type="button" variant="ghost" size="sm" onClick={() => setReplying((v) => !v)}>
                                <MessageSquare /> Reply
                            </Button>
                            {isOwner && (
                                <>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                                        <Pencil /> Edit
                                    </Button>
                                    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                                        <AlertDialogTrigger asChild>
                                            <Button type="button" variant="ghost" size="sm">
                                                <Trash2 /> Delete
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This can&apos;t be undone. Replies to this comment will stay visible.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                                                    Delete
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </>
                            )}
                        </div>
                    )}

                    {replying && (
                        <div className="mt-3">
                            <CommentForm
                                isLoggedIn={isLoggedIn}
                                autoFocus
                                submitLabel="Reply"
                                onCancel={() => setReplying(false)}
                                onSubmit={(content) => {
                                    onReply(content, node.id);
                                    setReplying(false);
                                }}
                            />
                        </div>
                    )}
                </>
            )}

            {node.replies.length > 0 && (
                <div className="mt-4 space-y-4">
                    {node.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            node={reply}
                            currentUserId={currentUserId}
                            isLoggedIn={isLoggedIn}
                            onReply={onReply}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
