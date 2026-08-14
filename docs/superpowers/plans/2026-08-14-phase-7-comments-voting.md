# Phase 7 — Comments & Voting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fully greenfield comment and voting subsystem (post votes, comment votes, user votes, threaded comments, a public user profile page) end to end, matching the design already agreed and written into `docs/revamp-plan.md`.

**Architecture:** Four Mongoose models converted to hardened TypeScript; a single shared `toggleVote` helper implements create/remove/switch semantics for all three vote kinds via `$inc` on denormalized counters; five `withApiGuard`-wrapped Route Handlers expose comment CRUD and vote toggling; the post read page and a new `/users/[username]` profile page fetch comments/votes server-side (SSR) and hand them to Client Components that use React 19's `useOptimistic` for instant UI feedback.

**Tech Stack:** Next.js 16 App Router, React 19 (`useOptimistic`, `useTransition`), Mongoose + `mongoose-delete`, NextAuth v5 (`withApiGuard`), shadcn/ui (`Button`, `Textarea`, `AlertDialog`, `Avatar`), `lucide-react`, `sonner`.

**Spec:** `docs/revamp-plan.md`, "### Phase 7 — Comments & voting" section (lines 105-153) — this plan implements that section exactly; read both together.

## Global Constraints

- Every mutating API route is wrapped with `withApiGuard` from `src/libs/api-guard.ts` — no inline auth logic in route files (per `CLAUDE.md` / the `api-route-security` skill).
- Ownership-only authorization throughout — this app has no admin/role concept. Every comment/vote mutation is scoped to `{ ..., userId: session.user.id }` or an equivalent ownership check.
- Never hard-delete. All deletes go through the `mongoose-delete` plugin's soft-delete (`.delete(deletedBy)`), matching `Post`/`User`/`Category`'s existing pattern.
- Comment/vote mutations on a post additionally require the post to satisfy `approval === "Approved" && published && visibility`, OR the requester owns the post — the same rule `src/app/posts/[slug]/page.tsx`'s `getPost()` already uses.
- Voting/commenting requires login — no anonymous flow. Self-voting on your own profile is rejected both client-side (button hidden) and server-side (defense in depth).
- New models are TypeScript (`.ts`), following `src/models/Post.ts`'s existing interface + schema + soft-delete pattern exactly — not left as untyped `.js`.
- Toggle/switch vote semantics are implemented once, in `src/libs/toggle-vote.ts`, and reused by all three vote routes — never duplicated per-route.
- Dev server runs on port 5000 (`npm run dev -- --port=5000`); if you start it for verification, kill it before finishing (`ss -ltnp | grep :5000` to confirm free).

---

## File Structure

**New files:**
- `src/models/Comment.ts`, `src/models/PostVote.ts`, `src/models/CommentVote.ts`, `src/models/UserVote.ts` — replace the untyped `.js` versions.
- `src/libs/toggle-vote.ts` — shared vote create/remove/switch logic.
- `src/libs/comment-tree.ts` — flat `Comment` list → nested reply tree, with soft-delete tombstoning.
- `src/app/api/posts/[slug]/comments/route.ts` — `POST` create comment.
- `src/app/api/comments/[id]/route.ts` — `PATCH`/`DELETE` own comment.
- `src/app/api/posts/[slug]/vote/route.ts`, `src/app/api/comments/[id]/vote/route.ts`, `src/app/api/users/[username]/vote/route.ts` — vote toggling.
- `src/app/users/[username]/page.tsx` — public profile page.
- `src/components/votes/VoteButtons.tsx` — shared up/down control.
- `src/components/comments/CommentForm.tsx`, `CommentItem.tsx`, `CommentSection.tsx`.

**Modified files:**
- `src/app/posts/[slug]/page.tsx` — add comment/vote SSR data fetching, render `VoteButtons` + `CommentSection`, link author name to their profile.
- `src/components/posts/ArticleCard.tsx` — add vote counts to `ArticleCardData` + render `VoteButtons`.
- `src/app/posts/page.tsx`, `src/components/layout/Articles.tsx` — batch-fetch the viewer's vote state for listed posts, pass to `ArticleCard`.

---

### Task 1: Convert and harden the four models

**Files:**
- Create: `src/models/Comment.ts`
- Create: `src/models/PostVote.ts`
- Create: `src/models/CommentVote.ts`
- Create: `src/models/UserVote.ts`
- Delete: `src/models/Comment.js`, `src/models/PostVote.js`, `src/models/CommentVote.js`, `src/models/UserVote.js`

**Interfaces:**
- Produces: `IComment` (`postId`, `parentId: Types.ObjectId | null`, `userId`, `content: string`, `upvoteCount: number`, `downvoteCount: number`, `visibility: boolean`, `editedAt: Date | null`, `createdAt: Date`, `updatedAt: Date`, plus soft-delete fields), and the default-exported `Comment` model (collection `comments`).
- Produces: `IPostVote` (`userId`, `postId`, `type: boolean`) and `PostVote` model (collection `post_votes`), unique on `{ userId, postId }`.
- Produces: `ICommentVote` (`userId`, `commentId`, `type: boolean`) and `CommentVote` model (collection `comment_votes`), unique on `{ userId, commentId }`.
- Produces: `IUserVote` (`userId`, `targetUserId`, `type: boolean` — renamed from `votingUserId`) and `UserVote` model (collection `user_votes`), unique on `{ userId, targetUserId }`.

- [ ] **Step 1: Write `src/models/Comment.ts`**

```ts
import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

const { Types: { ObjectId } } = Schema;
type ICommentWithSoftDelete = Document & SoftDeleteDocument;

export interface IComment extends ICommentWithSoftDelete {
  postId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  userId: Types.ObjectId;
  content: string;
  upvoteCount: number;
  downvoteCount: number;
  visibility: boolean;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IComment>(
  {
    postId: { type: ObjectId, ref: "Post", required: true },
    parentId: { type: ObjectId, ref: "Comment", default: null },
    userId: { type: ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    upvoteCount: { type: Number, default: 0 },
    downvoteCount: { type: Number, default: 0 },
    visibility: { type: Boolean, default: true },
    editedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt: true, deletedBy: true, overrideMethods: true });

schema.index({ postId: 1, parentId: 1 });

// Hide soft-delete metadata in API responses
schema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    delete ret.deleted;
    delete ret.deletedAt;
    delete ret.deletedBy;
    return ret;
  },
});

const Comment = mongoose.models?.Comment || mongoose.model<IComment, SoftDeleteModel<IComment>>('Comment', schema, 'comments');
export default Comment;
```

- [ ] **Step 2: Write `src/models/PostVote.ts`**

```ts
import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

const { Types: { ObjectId } } = Schema;
type IPostVoteWithSoftDelete = Document & SoftDeleteDocument;

export interface IPostVote extends IPostVoteWithSoftDelete {
  userId: Types.ObjectId;
  postId: Types.ObjectId;
  type: boolean;
}

const schema = new Schema<IPostVote>(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    postId: { type: ObjectId, ref: "Post", required: true },
    type: { type: Boolean, required: true },
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt: true, deletedBy: true, overrideMethods: true });

schema.index({ userId: 1, postId: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

schema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    delete ret.deleted;
    delete ret.deletedAt;
    delete ret.deletedBy;
    return ret;
  },
});

const PostVote = mongoose.models?.PostVote || mongoose.model<IPostVote, SoftDeleteModel<IPostVote>>('PostVote', schema, 'post_votes');
export default PostVote;
```

- [ ] **Step 3: Write `src/models/CommentVote.ts`**

```ts
import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

const { Types: { ObjectId } } = Schema;
type ICommentVoteWithSoftDelete = Document & SoftDeleteDocument;

export interface ICommentVote extends ICommentVoteWithSoftDelete {
  userId: Types.ObjectId;
  commentId: Types.ObjectId;
  type: boolean;
}

const schema = new Schema<ICommentVote>(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    commentId: { type: ObjectId, ref: "Comment", required: true },
    type: { type: Boolean, required: true },
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt: true, deletedBy: true, overrideMethods: true });

schema.index({ userId: 1, commentId: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

schema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    delete ret.deleted;
    delete ret.deletedAt;
    delete ret.deletedBy;
    return ret;
  },
});

const CommentVote = mongoose.models?.CommentVote || mongoose.model<ICommentVote, SoftDeleteModel<ICommentVote>>('CommentVote', schema, 'comment_votes');
export default CommentVote;
```

- [ ] **Step 4: Write `src/models/UserVote.ts`**

```ts
import mongooseDelete, { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import mongoose, { Schema, Document, Types } from 'mongoose';

const { Types: { ObjectId } } = Schema;
type IUserVoteWithSoftDelete = Document & SoftDeleteDocument;

export interface IUserVote extends IUserVoteWithSoftDelete {
  userId: Types.ObjectId;
  targetUserId: Types.ObjectId;
  type: boolean;
}

const schema = new Schema<IUserVote>(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    targetUserId: { type: ObjectId, ref: "User", required: true },
    type: { type: Boolean, required: true },
  },
  {
    timestamps: true,
  }
);

schema.plugin(mongooseDelete, { deletedAt: true, deletedBy: true, overrideMethods: true });

schema.index({ userId: 1, targetUserId: 1 }, { unique: true, partialFilterExpression: { deleted: false } });

schema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    delete ret.deleted;
    delete ret.deletedAt;
    delete ret.deletedBy;
    return ret;
  },
});

const UserVote = mongoose.models?.UserVote || mongoose.model<IUserVote, SoftDeleteModel<IUserVote>>('UserVote', schema, 'user_votes');
export default UserVote;
```

- [ ] **Step 5: Delete the old untyped model files**

```bash
rm src/models/Comment.js src/models/PostVote.js src/models/CommentVote.js src/models/UserVote.js
```

- [ ] **Step 6: Verify — typecheck and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (no page references these models yet, so this only proves the model files themselves compile and don't collide with existing collections).

- [ ] **Step 7: Commit**

```bash
git add src/models/Comment.ts src/models/PostVote.ts src/models/CommentVote.ts src/models/UserVote.ts
git add src/models/Comment.js src/models/PostVote.js src/models/CommentVote.js src/models/UserVote.js
git commit -m "Convert Comment/PostVote/CommentVote/UserVote to typed, hardened Mongoose models"
```

---

### Task 2: Shared vote toggle/switch helper

**Files:**
- Create: `src/libs/toggle-vote.ts`

**Interfaces:**
- Consumes: nothing project-specific — takes a Mongoose model, a filter, a counter-owning model, and a vote type.
- Produces: `toggleVote(options: ToggleVoteOptions): Promise<VoteResult>` where `VoteResult = { action: "created" | "removed" | "switched"; currentType: boolean | null }`. Later tasks (3, 4) import this exact signature.

- [ ] **Step 1: Write `src/libs/toggle-vote.ts`**

```ts
import type { Types } from "mongoose";

interface VoteDocument {
    type: boolean;
    delete: (deletedBy?: string) => Promise<unknown>;
    save: () => Promise<unknown>;
}

export type VoteAction = "created" | "removed" | "switched";

export interface VoteResult {
    action: VoteAction;
    currentType: boolean | null;
}

interface ToggleVoteOptions {
    // Typed loosely: mongoose's Model<T, ...> generic has enough type
    // parameters that a precise type here fights variance for no benefit —
    // the actual safety comes from the VoteDocument cast on the result.
    voteModel: any;
    voteFilter: Record<string, unknown>;
    counterModel: any;
    counterId: Types.ObjectId | string;
    type: boolean;
    voterId: string;
}

/**
 * Shared toggle/switch semantics for post, comment, and user votes:
 * no existing vote creates one; voting the same type again removes it
 * (toggle off); voting the opposite type switches it. Each branch keeps
 * the target document's denormalized upvoteCount/downvoteCount in sync
 * via $inc in the same request — not a separate reconciliation job.
 */
export async function toggleVote({
    voteModel,
    voteFilter,
    counterModel,
    counterId,
    type,
    voterId,
}: ToggleVoteOptions): Promise<VoteResult> {
    const existing = (await voteModel.findOne(voteFilter)) as VoteDocument | null;

    if (!existing) {
        await voteModel.create({ ...voteFilter, type });
        await counterModel.updateOne(
            { _id: counterId },
            { $inc: { [type ? "upvoteCount" : "downvoteCount"]: 1 } }
        );
        return { action: "created", currentType: type };
    }

    if (existing.type === type) {
        await existing.delete(voterId);
        await counterModel.updateOne(
            { _id: counterId },
            { $inc: { [type ? "upvoteCount" : "downvoteCount"]: -1 } }
        );
        return { action: "removed", currentType: null };
    }

    existing.type = type;
    await existing.save();
    await counterModel.updateOne(
        { _id: counterId },
        { $inc: { upvoteCount: type ? 1 : -1, downvoteCount: type ? -1 : 1 } }
    );
    return { action: "switched", currentType: type };
}
```

- [ ] **Step 2: Verify — typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/libs/toggle-vote.ts
git commit -m "Add shared toggle/switch vote helper for post, comment, and user votes"
```

---

### Task 3: Post voting — `VoteButtons` + vote route, wired into the post read page

**Files:**
- Create: `src/components/votes/VoteButtons.tsx`
- Create: `src/app/api/posts/[slug]/vote/route.ts`
- Modify: `src/app/posts/[slug]/page.tsx`

**Interfaces:**
- Consumes: `toggleVote` from Task 2.
- Produces: `VoteButtons` component (`voteUrl: string`, `initialState: VoteState`, `isLoggedIn: boolean`, `size?: "default" | "sm"`, `className?: string`), and `VoteState = { upvoteCount: number; downvoteCount: number; myVote: boolean | null }`. Tasks 4, 6, 7, 8 reuse this component and type as-is.
- Produces: `POST /api/posts/[slug]/vote` — body `{ type: boolean }`, response `{ data: { action, myVote, upvoteCount, downvoteCount }, message }`.

- [ ] **Step 1: Write `src/components/votes/VoteButtons.tsx`**

```tsx
"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface VoteState {
    upvoteCount: number;
    downvoteCount: number;
    myVote: boolean | null;
}

interface VoteButtonsProps {
    voteUrl: string;
    initialState: VoteState;
    isLoggedIn: boolean;
    size?: "default" | "sm";
    className?: string;
}

function applyVote(current: VoteState, type: boolean): VoteState {
    if (current.myVote === type) {
        return {
            upvoteCount: current.upvoteCount - (type ? 1 : 0),
            downvoteCount: current.downvoteCount - (type ? 0 : 1),
            myVote: null,
        };
    }
    if (current.myVote === null) {
        return {
            upvoteCount: current.upvoteCount + (type ? 1 : 0),
            downvoteCount: current.downvoteCount + (type ? 0 : 1),
            myVote: type,
        };
    }
    return {
        upvoteCount: current.upvoteCount + (type ? 1 : -1),
        downvoteCount: current.downvoteCount + (type ? -1 : 1),
        myVote: type,
    };
}

export default function VoteButtons({ voteUrl, initialState, isLoggedIn, size = "default", className }: VoteButtonsProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [state, setState] = useState(initialState);
    const [optimisticState, applyOptimistic] = useOptimistic(state, applyVote);

    const requireLogin = () => {
        router.push(`/auth/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
    };

    const handleVote = (event: React.MouseEvent, type: boolean) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isLoggedIn) {
            requireLogin();
            return;
        }
        startTransition(async () => {
            applyOptimistic(type);
            try {
                const response = await fetch(voteUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type }),
                });
                if (response.status === 401) {
                    requireLogin();
                    return;
                }
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to record vote.");
                    return;
                }
                setState({
                    upvoteCount: result.data.upvoteCount,
                    downvoteCount: result.data.downvoteCount,
                    myVote: result.data.myVote,
                });
            } catch {
                toast.error("Failed to record vote.");
            }
        });
    };

    const score = optimisticState.upvoteCount - optimisticState.downvoteCount;
    const buttonSize = size === "sm" ? "icon-xs" : "icon-sm";

    return (
        <div className={cn("inline-flex items-center gap-1 rounded-full border border-border px-1 py-0.5", className)}>
            <Button
                type="button"
                variant="ghost"
                size={buttonSize}
                disabled={pending}
                aria-pressed={optimisticState.myVote === true}
                onClick={(event) => handleVote(event, true)}
                className={cn(optimisticState.myVote === true && "text-teal")}
            >
                <ArrowBigUp className={cn(optimisticState.myVote === true && "fill-current")} />
                <span className="sr-only">Upvote</span>
            </Button>
            <span className="min-w-4 text-center font-mono text-xs tabular-nums text-muted-foreground">{score}</span>
            <Button
                type="button"
                variant="ghost"
                size={buttonSize}
                disabled={pending}
                aria-pressed={optimisticState.myVote === false}
                onClick={(event) => handleVote(event, false)}
                className={cn(optimisticState.myVote === false && "text-destructive")}
            >
                <ArrowBigDown className={cn(optimisticState.myVote === false && "fill-current")} />
                <span className="sr-only">Downvote</span>
            </Button>
        </div>
    );
}
```

- [ ] **Step 2: Write `src/app/api/posts/[slug]/vote/route.ts`**

```ts
import { NextResponse } from "next/server";
import dbConnect from "@/libs/db-connect";
import Post from "@/models/Post";
import PostVote from "@/models/PostVote";
import { withApiGuard } from "@/libs/api-guard";
import { toggleVote } from "@/libs/toggle-vote";

interface RouteContext {
    params: Promise<{ slug: string }>;
}

export const POST = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { slug } = await params;
        const body = await request.json().catch(() => null);
        if (typeof body?.type !== "boolean") {
            return NextResponse.json({ data: null, message: "type must be a boolean" }, { status: 400 });
        }

        await dbConnect();

        const post = await Post.findOne({ slug });
        if (!post) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }

        const isOwner = post.userId?.toString() === session.user.id;
        const isPubliclyVisible = post.approval === "Approved" && post.published && post.visibility;
        if (!isPubliclyVisible && !isOwner) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }

        const result = await toggleVote({
            voteModel: PostVote,
            voteFilter: { userId: session.user.id, postId: post._id },
            counterModel: Post,
            counterId: post._id,
            type: body.type,
            voterId: session.user.id,
        });

        const updated = await Post.findById(post._id).select("upvoteCount downvoteCount").lean();

        return NextResponse.json({
            data: {
                action: result.action,
                myVote: result.currentType,
                upvoteCount: updated?.upvoteCount ?? 0,
                downvoteCount: updated?.downvoteCount ?? 0,
            },
            message: "Success",
        });
    } catch (error) {
        console.error("Failed to toggle post vote:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
```

- [ ] **Step 3: Wire `VoteButtons` into the post read page**

In `src/app/posts/[slug]/page.tsx`, add the import and a `PostVote` lookup, then render the control.

Add to the imports:

```tsx
import PostVote from "@/models/PostVote";
import VoteButtons from "@/components/votes/VoteButtons";
```

Add a cached vote lookup next to `getPost`:

```tsx
const getMyPostVote = cache(async (postId: string, userId: string | undefined) => {
    if (!userId) return null;
    await dbConnect();
    const vote = await PostVote.findOne({ userId, postId }).lean();
    return vote ? Boolean(vote.type) : null;
});
```

In `PostPage`, after `const post = await getPost(slug); if (!post) notFound();`, add:

```tsx
const session = await getSession();
const myVote = await getMyPostVote(post._id.toString(), session?.user?.id);
```

Render `VoteButtons` in the centered header block, right after the existing `authorLabel`/`dateLabel`/`readingTime` row:

```tsx
<div className="mt-6 flex justify-center">
    <VoteButtons
        voteUrl={`/api/posts/${post.slug}/vote`}
        initialState={{ upvoteCount: post.upvoteCount, downvoteCount: post.downvoteCount, myVote }}
        isLoggedIn={Boolean(session?.user)}
    />
</div>
```

- [ ] **Step 4: Verify — typecheck, build, then a live vote cycle**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors, build succeeds.

Start the dev server (`npm run dev -- --port=5000`), log in via the browser (Playwright), open an existing published post, click upvote (count increments, button highlights), click upvote again (toggles off, count returns to baseline), click downvote then upvote (switches: downvote count decrements, upvote count increments). Confirm in Mongo (or via a scratch `tsx` script) that only one non-deleted `PostVote` document exists per `(userId, postId)` after the sequence. Kill the dev server afterward and confirm port 5000 is free.

- [ ] **Step 5: Commit**

```bash
git add src/components/votes/VoteButtons.tsx src/app/api/posts/[slug]/vote/route.ts src/app/posts/[slug]/page.tsx
git commit -m "Add post voting: toggle/switch API route, VoteButtons control, wired into the post read page"
```

---

### Task 4: Comment voting and user (profile) voting routes

**Files:**
- Create: `src/app/api/comments/[id]/vote/route.ts`
- Create: `src/app/api/users/[username]/vote/route.ts`

**Interfaces:**
- Consumes: `toggleVote` (Task 2). No UI change in this task — `VoteButtons` (Task 3) is reused later by Tasks 6 and 7 against these routes.
- Produces: `POST /api/comments/[id]/vote` and `POST /api/users/[username]/vote`, same request/response shape as the post vote route.

- [ ] **Step 1: Write `src/app/api/comments/[id]/vote/route.ts`**

```ts
import { NextResponse } from "next/server";
import dbConnect from "@/libs/db-connect";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import CommentVote from "@/models/CommentVote";
import { withApiGuard } from "@/libs/api-guard";
import { toggleVote } from "@/libs/toggle-vote";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const POST = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => null);
        if (typeof body?.type !== "boolean") {
            return NextResponse.json({ data: null, message: "type must be a boolean" }, { status: 400 });
        }

        await dbConnect();

        const comment = await Comment.findById(id);
        if (!comment) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        const post = await Post.findById(comment.postId);
        if (!post) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        const isOwner = post.userId?.toString() === session.user.id;
        const isPubliclyVisible = post.approval === "Approved" && post.published && post.visibility;
        if (!isPubliclyVisible && !isOwner) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        const result = await toggleVote({
            voteModel: CommentVote,
            voteFilter: { userId: session.user.id, commentId: comment._id },
            counterModel: Comment,
            counterId: comment._id,
            type: body.type,
            voterId: session.user.id,
        });

        const updated = await Comment.findById(comment._id).select("upvoteCount downvoteCount").lean();

        return NextResponse.json({
            data: {
                action: result.action,
                myVote: result.currentType,
                upvoteCount: updated?.upvoteCount ?? 0,
                downvoteCount: updated?.downvoteCount ?? 0,
            },
            message: "Success",
        });
    } catch (error) {
        console.error("Failed to toggle comment vote:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
```

- [ ] **Step 2: Write `src/app/api/users/[username]/vote/route.ts`**

```ts
import { NextResponse } from "next/server";
import dbConnect from "@/libs/db-connect";
import User from "@/models/User";
import UserVote from "@/models/UserVote";
import { withApiGuard } from "@/libs/api-guard";
import { toggleVote } from "@/libs/toggle-vote";

interface RouteContext {
    params: Promise<{ username: string }>;
}

export const POST = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { username } = await params;
        const body = await request.json().catch(() => null);
        if (typeof body?.type !== "boolean") {
            return NextResponse.json({ data: null, message: "type must be a boolean" }, { status: 400 });
        }

        await dbConnect();

        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return NextResponse.json({ data: null, message: "User not found" }, { status: 404 });
        }

        if (targetUser._id.toString() === session.user.id) {
            return NextResponse.json({ data: null, message: "You can't vote on your own profile" }, { status: 400 });
        }

        const result = await toggleVote({
            voteModel: UserVote,
            voteFilter: { userId: session.user.id, targetUserId: targetUser._id },
            counterModel: User,
            counterId: targetUser._id,
            type: body.type,
            voterId: session.user.id,
        });

        const updated = await User.findById(targetUser._id).select("upvoteCount downvoteCount").lean();

        return NextResponse.json({
            data: {
                action: result.action,
                myVote: result.currentType,
                upvoteCount: updated?.upvoteCount ?? 0,
                downvoteCount: updated?.downvoteCount ?? 0,
            },
            message: "Success",
        });
    } catch (error) {
        console.error("Failed to toggle user vote:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
```

- [ ] **Step 3: Verify — typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors. (No UI exercises these routes yet — Tasks 6/7 add that; this step only proves the routes compile and the app still builds.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/comments/[id]/vote/route.ts src/app/api/users/[username]/vote/route.ts
git commit -m "Add comment and user voting API routes on the shared toggle-vote helper"
```

---

### Task 5: Comment tree helper + comment CRUD routes

**Files:**
- Create: `src/libs/comment-tree.ts`
- Create: `src/app/api/posts/[slug]/comments/route.ts`
- Create: `src/app/api/comments/[id]/route.ts`

**Interfaces:**
- Produces: `buildCommentTree(flat: FlatComment[]): CommentNode[]` and the `CommentNode`/`FlatComment` types. Task 6 imports both types and this function directly.
- Produces: `POST /api/posts/[slug]/comments` (body `{ content: string; parentId?: string | null }`, response `{ data: { id, parentId, content, createdAt }, message }`), `PATCH /api/comments/[id]` (body `{ content: string }`), `DELETE /api/comments/[id]`.

- [ ] **Step 1: Write `src/libs/comment-tree.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/app/api/posts/[slug]/comments/route.ts`**

```ts
import { NextResponse } from "next/server";
import dbConnect from "@/libs/db-connect";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import { withApiGuard } from "@/libs/api-guard";

interface RouteContext {
    params: Promise<{ slug: string }>;
}

export const POST = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { slug } = await params;
        const body = await request.json().catch(() => null);
        const content = typeof body?.content === "string" ? body.content.trim() : "";
        const parentId = typeof body?.parentId === "string" ? body.parentId : null;

        if (!content) {
            return NextResponse.json({ data: null, message: "Comment can't be empty" }, { status: 400 });
        }

        await dbConnect();

        const post = await Post.findOne({ slug });
        if (!post) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }

        const isOwner = post.userId?.toString() === session.user.id;
        const isPubliclyVisible = post.approval === "Approved" && post.published && post.visibility;
        if (!isPubliclyVisible && !isOwner) {
            return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
        }

        if (parentId) {
            const parent = await Comment.findOne({ _id: parentId, postId: post._id });
            if (!parent) {
                return NextResponse.json({ data: null, message: "Parent comment not found" }, { status: 400 });
            }
        }

        const comment = await Comment.create({
            postId: post._id,
            parentId: parentId || null,
            userId: session.user.id,
            content,
        });

        await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });

        return NextResponse.json({
            data: {
                id: comment._id.toString(),
                parentId,
                content: comment.content,
                createdAt: comment.createdAt.toISOString(),
            },
            message: "Success",
        });
    } catch (error) {
        console.error("Failed to create comment:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
```

- [ ] **Step 3: Write `src/app/api/comments/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import dbConnect from "@/libs/db-connect";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import { withApiGuard } from "@/libs/api-guard";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;
        const body = await request.json().catch(() => null);
        const content = typeof body?.content === "string" ? body.content.trim() : "";
        if (!content) {
            return NextResponse.json({ data: null, message: "Comment can't be empty" }, { status: 400 });
        }

        await dbConnect();

        const comment = await Comment.findOneAndUpdate(
            { _id: id, userId: session.user.id },
            { content, editedAt: new Date() },
            { new: true }
        );

        if (!comment) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        return NextResponse.json({
            data: { id: comment._id.toString(), content: comment.content, editedAt: comment.editedAt?.toISOString() ?? null },
            message: "Success",
        });
    } catch (error) {
        console.error("Failed to update comment:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});

export const DELETE = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;

        await dbConnect();

        const comment = await Comment.findOne({ _id: id, userId: session.user.id });
        if (!comment) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        await comment.delete(session.user.id);
        await Post.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });

        return NextResponse.json({ data: null, message: "Success" });
    } catch (error) {
        console.error("Failed to delete comment:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
```

- [ ] **Step 4: Verify — typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/libs/comment-tree.ts src/app/api/posts/[slug]/comments/route.ts src/app/api/comments/[id]/route.ts
git commit -m "Add comment create/edit/delete API routes and the flat-to-tree comment builder"
```

---

### Task 6: Comment UI, wired into the post read page

**Files:**
- Create: `src/components/comments/CommentForm.tsx`
- Create: `src/components/comments/CommentItem.tsx`
- Create: `src/components/comments/CommentSection.tsx`
- Modify: `src/app/posts/[slug]/page.tsx`

**Interfaces:**
- Consumes: `buildCommentTree`/`CommentNode`/`FlatComment` (Task 5), `VoteButtons` (Task 3), the comment API routes (Task 5).
- Produces: `CommentSection` (`postSlug: string`, `initialComments: CommentNode[]`, `isLoggedIn: boolean`, `currentUserId: string | null`) — the only piece the post page needs to render.

- [ ] **Step 1: Write `src/components/comments/CommentForm.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentFormProps {
    isLoggedIn: boolean;
    onSubmit: (content: string) => void;
    onCancel?: () => void;
    autoFocus?: boolean;
    placeholder?: string;
    submitLabel?: string;
}

export default function CommentForm({
    isLoggedIn,
    onSubmit,
    onCancel,
    autoFocus = false,
    placeholder = "Add to the discussion…",
    submitLabel = "Comment",
}: CommentFormProps) {
    const router = useRouter();
    const [content, setContent] = useState("");

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        const trimmed = content.trim();
        if (!trimmed) return;
        if (!isLoggedIn) {
            router.push(`/auth/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
            return;
        }
        onSubmit(trimmed);
        setContent("");
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder={isLoggedIn ? placeholder : "Log in to join the discussion."}
                disabled={!isLoggedIn}
                autoFocus={autoFocus}
                rows={3}
            />
            <div className="flex justify-end gap-2">
                {onCancel && (
                    <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" size="sm" disabled={isLoggedIn && content.trim().length === 0}>
                    {isLoggedIn ? submitLabel : "Log in"}
                </Button>
            </div>
        </form>
    );
}
```

- [ ] **Step 2: Write `src/components/comments/CommentItem.tsx`**

```tsx
"use client";

import { useState, useTransition, type MouseEvent } from "react";
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
                        <span className="font-medium text-foreground">{node.authorUsername ?? "Unknown"}</span>
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
                                initialState={{ upvoteCount: node.upvoteCount, downvoteCount: node.downvoteCount, myVote: null }}
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
```

- [ ] **Step 3: Write `src/components/comments/CommentSection.tsx`**

```tsx
"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CommentNode } from "@/libs/comment-tree";
import CommentForm from "@/components/comments/CommentForm";
import CommentItem from "@/components/comments/CommentItem";

interface CommentSectionProps {
    postSlug: string;
    initialComments: CommentNode[];
    isLoggedIn: boolean;
    currentUserId: string | null;
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

export default function CommentSection({ postSlug, initialComments, isLoggedIn, currentUserId }: CommentSectionProps) {
    const router = useRouter();
    const [comments, setComments] = useState(initialComments);
    const [optimisticComments, applyOptimistic] = useOptimistic(comments, reduceComments);
    const [, startTransition] = useTransition();

    const requireLogin = () => {
        router.push(`/auth/login?callbackUrl=${encodeURIComponent(location.pathname)}`);
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
            authorUsername: null,
            upvoteCount: 0,
            downvoteCount: 0,
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
```

- [ ] **Step 4: Wire `CommentSection` into the post read page**

In `src/app/posts/[slug]/page.tsx`, add to the imports:

```tsx
import Comment from "@/models/Comment";
import { buildCommentTree, type FlatComment } from "@/libs/comment-tree";
import CommentSection from "@/components/comments/CommentSection";
```

Add a cached comment-tree fetch next to `getMyPostVote` (from Task 3):

```tsx
const getComments = cache(async (postId: string) => {
    await dbConnect();
    const flat = await Comment.findWithDeleted({ postId })
        .populate({ path: "userId", model: User, select: "username" })
        .sort({ createdAt: 1 })
        .lean();
    return buildCommentTree(flat as unknown as FlatComment[]);
});
```

`Comment` isn't typed with `findWithDeleted` on its inferred model type (same situation `Post`'s `DELETE` route already works around) — cast it once, right above `getComments`:

```tsx
import type { SoftDeleteModel } from "mongoose-delete";
import type { IComment } from "@/models/Comment";

const SoftDeleteComment = Comment as unknown as SoftDeleteModel<IComment>;
```

and call `SoftDeleteComment.findWithDeleted(...)` instead of `Comment.findWithDeleted(...)` in `getComments`.

In `PostPage`, after the `getMyPostVote` call from Task 3, add:

```tsx
const comments = await getComments(post._id.toString());
```

Render `CommentSection` at the very end of the article, after the tags block:

```tsx
<CommentSection
    postSlug={post.slug}
    initialComments={comments}
    isLoggedIn={Boolean(session?.user)}
    currentUserId={session?.user?.id ?? null}
/>
```

- [ ] **Step 5: Verify — typecheck, build, then a live comment cycle**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

Start the dev server, log in, open a published post: post a top-level comment (appears instantly, optimistic), reply to it (nested one level deep), reply to the reply (confirms unlimited nesting renders correctly), edit your own comment, delete a childless comment (disappears), delete a comment that has replies (becomes "[deleted]" but replies stay visible). Log in as a second account and confirm editing/deleting the first account's comment is not offered in the UI, and a direct `fetch(..., { method: "PATCH" })` against someone else's comment ID returns 404. Kill the dev server afterward and confirm port 5000 is free.

- [ ] **Step 6: Commit**

```bash
git add src/components/comments/CommentForm.tsx src/components/comments/CommentItem.tsx src/components/comments/CommentSection.tsx src/app/posts/[slug]/page.tsx
git commit -m "Add threaded comment UI with optimistic add/edit/delete, wired into the post read page"
```

---

### Task 7: Public user profile page (`/users/[username]`)

**Files:**
- Create: `src/app/users/[username]/page.tsx`
- Modify: `src/app/posts/[slug]/page.tsx` — link the author name to their profile.

**Interfaces:**
- Consumes: `VoteButtons` (Task 3), `ArticleCard`/`toArticleCardData` (existing, extended in Task 8 — this task uses it as-is since Task 8's extra props are optional).
- Produces: a public route at `/users/[username]` — no exports other components depend on.

- [ ] **Step 1: Write `src/app/users/[username]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import dbConnect from "@/libs/db-connect";
import User from "@/models/User";
import Post from "@/models/Post";
import Category from "@/models/Category";
import UserVote from "@/models/UserVote";
import { getSession } from "@/libs/api-guard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ArticleGrid from "@/components/posts/ArticleGrid";
import ArticleCard, { toArticleCardData } from "@/components/posts/ArticleCard";
import VoteButtons from "@/components/votes/VoteButtons";

interface ProfilePageProps {
    params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
    const { username } = await params;
    await dbConnect();
    const user = await User.findOne({ username }).select("username").lean();
    if (!user) return {};
    return { title: `${username} — Vedev.Guru` };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
    const { username } = await params;

    await dbConnect();
    const profileUser = await User.findOne({ username })
        .select("username avatar intro profile upvoteCount downvoteCount")
        .lean();
    if (!profileUser) notFound();

    const session = await getSession();
    const isOwnProfile = session?.user?.id === profileUser._id.toString();

    const myVote =
        !isOwnProfile && session?.user?.id
            ? await UserVote.findOne({ userId: session.user.id, targetUserId: profileUser._id }).lean()
            : null;

    const posts = await Post.find({ userId: profileUser._id, approval: "Approved", published: true, visibility: true })
        .sort({ publishedAt: -1 })
        .populate({ path: "categoryId", model: Category, select: "title" })
        .select("slug title titleDescription bannerImage publishedAt categoryId upvoteCount downvoteCount")
        .lean();

    const articles = posts.map((post) => toArticleCardData(post as unknown as Parameters<typeof toArticleCardData>[0]));

    return (
        <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="flex flex-col items-center text-center">
                <Avatar size="lg">
                    <AvatarImage src={profileUser.avatar || undefined} alt={profileUser.username} />
                    <AvatarFallback className="text-2xl">{profileUser.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <h1 className="mt-4 font-heading text-4xl font-semibold tracking-tight text-foreground">
                    {profileUser.username}
                </h1>
                {profileUser.intro && <p className="mt-2 text-muted-foreground">{profileUser.intro}</p>}
                {profileUser.profile && <p className="mt-4 max-w-xl text-sm text-foreground">{profileUser.profile}</p>}

                {!isOwnProfile && (
                    <div className="mt-6">
                        <VoteButtons
                            voteUrl={`/api/users/${profileUser.username}/vote`}
                            initialState={{
                                upvoteCount: profileUser.upvoteCount ?? 0,
                                downvoteCount: profileUser.downvoteCount ?? 0,
                                myVote: myVote ? Boolean(myVote.type) : null,
                            }}
                            isLoggedIn={Boolean(session?.user)}
                        />
                    </div>
                )}
            </div>

            <div className="mt-14">
                <h2 className="font-heading text-2xl font-semibold text-foreground">Published posts</h2>
                <div className="mt-6">
                    {articles.length > 0 ? (
                        <ArticleGrid>
                            {articles.map((article) => (
                                <ArticleCard key={article.slug} article={article} isLoggedIn={Boolean(session?.user)} />
                            ))}
                        </ArticleGrid>
                    ) : (
                        <p className="text-sm text-muted-foreground">No published posts yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
```

`isLoggedIn` is passed so a logged-in viewer can actually vote from these cards instead of being redirected to login (Task 8 defaults `ArticleCard`'s `isLoggedIn` prop to `false`). Per-card `myVote` initial highlighting is left to its default (`null`) here — Task 8 is what adds the batch vote lookup this page would need to pre-highlight it; skipping that on the profile grid is an acceptable gap since a click still lands correctly and reconciles from the server response.

- [ ] **Step 2: Link the post page's author name to the profile**

In `src/app/posts/[slug]/page.tsx`, add `import Link from "next/link";` to the imports.

Change the `MetaItem` helper to accept an optional `href`:

```tsx
function MetaItem({ label, value, href }: { label: string; value: string; href?: string }) {
    return (
        <div>
            <p className="font-mono text-[11px] tracking-widest text-teal uppercase">{label}</p>
            {href ? (
                <Link href={href} className="mt-1 block text-sm text-foreground hover:text-teal">
                    {value}
                </Link>
            ) : (
                <p className="mt-1 text-sm text-foreground">{value}</p>
            )}
        </div>
    );
}
```

Change the "Written by" call site to pass the profile link:

```tsx
{authorLabel && <MetaItem label="Written by" value={authorLabel} href={`/users/${authorLabel}`} />}
```

Change the mobile meta row's plain `<span>{authorLabel}</span>` to a link too:

```tsx
{authorLabel && (
    <Link href={`/users/${authorLabel}`} className="hover:text-teal">
        {authorLabel}
    </Link>
)}
```

- [ ] **Step 3: Verify — typecheck, build, then a live walkthrough**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

Start the dev server. Visit `/users/<existing-username>` directly — confirm it renders bio + published posts (drafts/pending posts by that user must NOT appear). Visit `/users/does-not-exist` — confirm 404. From a post page, click the author name — confirm it navigates to their profile. While logged in as a *different* user, upvote/downvote on that profile — confirm the score updates and toggling/switching works exactly like post votes. Visit your own profile — confirm the vote control is absent. As a direct check, `fetch` `POST /api/users/<your-own-username>/vote` while logged in as yourself — confirm it 400s. Kill the dev server afterward and confirm port 5000 is free.

- [ ] **Step 4: Commit**

```bash
git add src/app/users/[username]/page.tsx src/app/posts/[slug]/page.tsx
git commit -m "Add public user profile pages with reputation voting, linked from post author names"
```

---

### Task 8: Voting from listing cards (`ArticleCard`)

**Files:**
- Modify: `src/components/posts/ArticleCard.tsx`
- Modify: `src/app/posts/page.tsx`
- Modify: `src/components/layout/Articles.tsx`

**Interfaces:**
- Consumes: `VoteButtons` (Task 3).
- Produces: `ArticleCardData` gains `upvoteCount: number` and `downvoteCount: number`; `ArticleCard` gains optional `isLoggedIn?: boolean` and `myVote?: boolean | null` props (default to `false`/`null` so Task 7's existing call sites keep compiling unchanged).

- [ ] **Step 1: Extend `ArticleCardData` and render `VoteButtons` in `ArticleCard`**

In `src/components/posts/ArticleCard.tsx`, add the import:

```tsx
import VoteButtons from "@/components/votes/VoteButtons";
```

Extend the two interfaces:

```tsx
export interface ArticleCardData {
    slug: string;
    title: string;
    excerpt: string;
    category?: string;
    bannerImage?: string;
    publishedAt?: string;
    upvoteCount: number;
    downvoteCount: number;
}

interface ArticleCardSourcePost {
    slug: string;
    title: string;
    titleDescription?: string;
    bannerImage?: string;
    publishedAt?: Date | string | null;
    categoryId?: { title?: string } | null;
    upvoteCount?: number;
    downvoteCount?: number;
}
```

Update `toArticleCardData`:

```tsx
export function toArticleCardData(post: ArticleCardSourcePost): ArticleCardData {
    return {
        slug: post.slug,
        title: post.title,
        excerpt: post.titleDescription || "",
        category: post.categoryId?.title,
        bannerImage: post.bannerImage || undefined,
        publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
        upvoteCount: post.upvoteCount ?? 0,
        downvoteCount: post.downvoteCount ?? 0,
    };
}
```

Update the component signature and render `VoteButtons` inside `CardContent`, below the excerpt (`VoteButtons` already stops click propagation itself, so it's safe to nest inside the card's wrapping `<Link>`):

```tsx
interface ArticleCardProps {
    article: ArticleCardData;
    isLoggedIn?: boolean;
    myVote?: boolean | null;
}

export default function ArticleCard({ article, isLoggedIn = false, myVote = null }: ArticleCardProps) {
    return (
        <Link href={`/posts/${article.slug}`} className="block h-full">
            <Card className="h-full gap-3 overflow-hidden border-none py-0 shadow-none ring-1 ring-border transition-shadow hover:shadow-md">
                {article.bannerImage && <BannerImage src={article.bannerImage} />}
                <CardHeader className="gap-2 pt-6">
                    <div className="flex items-center justify-between font-mono text-[11px] tracking-widest uppercase">
                        {article.category && <span className="text-teal">{article.category}</span>}
                        {article.publishedAt && (
                            <span className="text-muted-foreground">
                                {new Date(article.publishedAt).toLocaleDateString("en-US", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </span>
                        )}
                    </div>
                    <h3 className="font-heading text-2xl font-semibold text-foreground">{article.title}</h3>
                </CardHeader>
                <CardContent className="pb-6">
                    <p className="line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p>
                    <div className="mt-4">
                        <VoteButtons
                            voteUrl={`/api/posts/${article.slug}/vote`}
                            initialState={{ upvoteCount: article.upvoteCount, downvoteCount: article.downvoteCount, myVote }}
                            isLoggedIn={isLoggedIn}
                            size="sm"
                        />
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
```

- [ ] **Step 2: Batch-fetch vote state in `src/app/posts/page.tsx`**

Add to the imports:

```tsx
import PostVote from "@/models/PostVote";
import { getSession } from "@/libs/api-guard";
```

Add `upvoteCount downvoteCount` to the existing `.select(...)` call on the `Post.find(filter)` query:

```tsx
.select("slug title titleDescription bannerImage publishedAt categoryId upvoteCount downvoteCount")
```

After the `Promise.all([...])` that fetches `total`/`posts`, add a batch vote lookup and build a lookup map:

```tsx
const session = await getSession();
const isLoggedIn = Boolean(session?.user);
const myVotes = isLoggedIn
    ? await PostVote.find({ userId: session!.user.id, postId: { $in: posts.map((p) => p._id) } })
          .select("postId type")
          .lean()
    : [];
const voteByPostId = new Map(myVotes.map((v) => [v.postId.toString(), Boolean(v.type)]));
```

Replace the existing `const articles = posts.map(...)` line with a version that carries each post's own vote state alongside it:

```tsx
const articles = posts.map((post) => ({
    ...toArticleCardData(post as unknown as Parameters<typeof toArticleCardData>[0]),
    myVote: voteByPostId.get(post._id.toString()) ?? null,
}));
```

And update the render loop to pass `isLoggedIn`/`myVote` through:

```tsx
{articles.map((article) => (
    <ArticleCard key={article.slug} article={article} isLoggedIn={isLoggedIn} myVote={article.myVote} />
))}
```

- [ ] **Step 3: Apply the same batch vote fetch to `src/components/layout/Articles.tsx`**

Add the imports:

```tsx
import PostVote from "@/models/PostVote";
import { getSession } from "@/libs/api-guard";
```

Add `upvoteCount downvoteCount` to its `.select(...)` call, then apply the same session + batch-vote-lookup + combined-`articles`-array pattern as Step 2, and pass `isLoggedIn`/`myVote` through to `<ArticleCard>` the same way.

- [ ] **Step 4: Verify — typecheck, build, then a live check**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

Start the dev server. On `/posts` and the homepage, confirm each card shows real vote counts and clicking a card's vote buttons does not navigate to the post (click lands on the button, not the link) while a click elsewhere on the card still navigates. Vote on a card, then open that post directly — confirm the post page's own `VoteButtons` shows the same `myVote` state (proves both surfaces read the same `PostVote` collection). Kill the dev server afterward and confirm port 5000 is free.

- [ ] **Step 5: Commit**

```bash
git add src/components/posts/ArticleCard.tsx src/app/posts/page.tsx src/components/layout/Articles.tsx
git commit -m "Add voting to post listing cards on /posts and the homepage"
```

---

### Task 9: Full verification pass and plan closeout

**Files:**
- Modify: `docs/revamp-plan.md` (mark Phase 7 as implemented).

- [ ] **Step 1: Run the full static check suite**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all three pass with no errors.

- [ ] **Step 2: End-to-end browser walkthrough (Playwright)**

Using two logged-in test accounts (or one account plus one logged-out session), walk through, in order, and confirm each behaves as specified:
1. Post voting: upvote, toggle off, downvote, switch to upvote — counts and highlighted state match at every step; confirm exactly one non-deleted `PostVote` doc exists per `(userId, postId)` after the sequence.
2. Comment voting: same sequence on a comment's `VoteButtons`.
3. Comment thread: top-level comment, nested reply, reply-to-reply, edit your own comment, delete a childless comment (vanishes), delete a comment with replies (becomes "[deleted]", replies remain).
4. Cross-user comment ownership: a second account cannot see edit/delete controls on the first account's comment, and a direct `PATCH`/`DELETE` call against it 404s.
5. Profile page: visit an existing user's `/users/[username]` — bio, vote score, and only their *approved+published+visible* posts appear; visit a non-existent username — 404; vote on someone else's profile — toggle/switch works; attempt to vote on your own profile — control is hidden in the UI and the API 400s on direct call.
6. Listing cards: vote from a card on `/posts` and the homepage without navigating away; the same vote state shows on the post's own page.
7. Logged-out: attempting any vote or comment action while logged out redirects to `/auth/login` with the current page as `callbackUrl`, both from a UI click and from a direct unauthenticated `fetch` (401).

Expected: every behavior above matches. If anything doesn't, return to the relevant task above and fix it before proceeding — do not paper over a failure here.

- [ ] **Step 3: Update `docs/revamp-plan.md`**

In the Phase 7 section, add a line right after the section heading noting it's implemented, e.g.:

```markdown
### Phase 7 — Comments & voting (net-new feature)

**Status: implemented.** See `docs/superpowers/plans/2026-08-14-phase-7-comments-voting.md` for the task-by-task build record.

```

(Keep the rest of the section's design content as-is — it documents the design that was built, not just a plan anymore.)

- [ ] **Step 4: Commit**

```bash
git add docs/revamp-plan.md
git commit -m "Mark Phase 7 (comments & voting) as implemented"
```
