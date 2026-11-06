# Comments

**Who:** signed-in users comment and reply; everyone reads. **Entry points:** the comments section under each post, reply and comment notifications (which link to the comment on the post).

## How it works

Comments are stored flat with a `parentId` and built into a thread on the post page (`src/libs/comment-tree.ts`, `src/components/comments/CommentSection.tsx`). A new comment appears at once under a temporary id and is swapped for the server's copy when `POST /api/posts/[slug]/comments` answers. Edits and deletes go through `PATCH`/`DELETE /api/comments/[id]`. Deletes are soft: a deleted comment with no surviving replies disappears, and one with replies stays as a "[deleted]" placeholder so the thread still reads. Each post keeps a `commentCount`.

## Flows

### 1. Comment and reply

**Preconditions:** signed in; a public post.

1. Writes in "Comment" and submits. → The comment appears at the end of the thread (comments are listed oldest first).
2. Chooses "Reply" under a comment, writes and submits. → The reply appears nested under it.

**Extensions:**

- 1a. Logged out: comments are readable; trying to comment sends the visitor to sign in and back to the post.
- 1b. Empty or whitespace-only text, or over 5000 characters: refused with the reason.
- 1c. More than 10 comments a minute from one address: "Too many requests".
- 2a. Replying to a comment from another post: refused.

**Side effects:** the post's author is notified of a comment, a comment's author of a reply (in-app and push per their preferences; nobody is notified of their own action); `commentCount` goes up.

**Tested by:** `e2e/publishing.spec.ts` › "a reader's comment notifies the post's author"; `e2e/comments.spec.ts` › "a logged-out visitor reads comments and is sent to log in to join".

### 2. Edit a comment

1. Chooses "Edit" on their own comment, changes it, saves. → The new text shows, marked "(edited)", and still does after a reload.

**Extensions:**

- 1a. Someone else's comment: no Edit button, and the API answers not found.

**Tested by:** `e2e/comments.spec.ts` › "a commenter edits their comment, and the edit survives a reload marked as edited".

### 3. Delete a comment

1. Chooses "Delete" on their own comment and confirms. → It disappears, or becomes "[deleted]" if it has replies; the post's count drops by one.

**Extensions:**

- 1a. Someone else's comment: refused (not found) unless the user is a moderator or admin.

**Tested by:** `e2e/comments.spec.ts` › "deleting comments keeps the thread readable and the post's count right", "comment routes refuse other people's comments, empty text and overlong text".

## Rules and limits

- `COMMENTS_ENABLED` (default on) switches comments off without a rebuild: post pages drop the comment section, and creating or editing a comment answers 403. Deleting still works, so moderators can remove what is already there. Tested by `src/app/api/posts/[slug]/comments/route.test.ts` and `src/app/api/comments/[id]/route.test.ts`.
- Length: 1 to 5000 characters after trimming.
- Rate limit: 10 new comments a minute per address.
- Moderators and admins can delete any comment, also from `/dashboard/admin/comments` (see [moderation.md](moderation.md)).
- Account deletion turns the user's comments under other people's posts into "[deleted]" placeholders (see [account-self-service.md](account-self-service.md)).
