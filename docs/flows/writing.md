# Writing

**Who:** authors and above (moderators and admins write too). **Entry points:** "Write" / `/posts/add`, "Edit" on a post or in My Posts (`/dashboard/posts`), "Revisions" (`/posts/[slug]/revisions`), a rejection notification linking to the edit page.

## How it works

The editor (`src/components/posts/PostForm.tsx`, Plate.js) creates posts through `POST /api/posts` and edits them through `PATCH /api/posts/[slug]`. New posts wait for a moderator (see [moderation.md](moderation.md)); an approved post stays approved when edited. Every edit snapshots the replaced version as a revision (`src/models/PostRevision.ts`), and a restore does the same, so it can be undone. Drafts autosave to the browser's local storage under the user's id (`src/libs/post-drafts.ts`). Images go through `POST /api/posts/upload` (`src/libs/image-upload.ts`): re-encoded without their metadata, GPS included, with the original camera, time and place kept privately in the `uploads` collection.

## Flows

### 1. Write and submit a post

**Preconditions:** signed in as an author or above.

1. Opens "Write". → The editor with title, description, summary, category, tags, banner and body.
2. Fills it in and inserts images. → Images upload as they're added and show inline.
3. Submits. → The post is in My Posts as "Pending"; readers can't see it yet.

**Extensions:**

- 1a. A reader opens `/posts/add`: redirected to My Posts (the role gate runs before the page).
- 2a. An image that isn't JPEG, PNG, WebP or GIF, has a forged type, is too large, or the daily, storage or hourly upload limit is reached: a message says which; the post is unaffected.
- 3a. Missing title, slug or body, a category that isn't offered, or a publish time that isn't within a year: the message says what to fix.
- 3b. A slug another post already uses: "A post with this slug already exists. Please choose a different slug."

**Side effects:** post record (approval Pending); moderators get a "post waiting for review" notification; upload records with private metadata.

**Tested by:** `e2e/publishing.spec.ts` › "an author's post goes live only after a moderator approves it"; `e2e/uploads.spec.ts` › "an author's uploaded image is served back from /uploads", "a photo's location never reaches readers; its metadata stays private with the upload record".

### 2. Drafts survive a reload

1. Types in the editor, then reloads or closes the tab. → Reopening the editor offers the autosaved draft.
2. Logs out. → Every draft in this browser is cleared, so the next person on a shared computer doesn't see it.

**Tested by:** `e2e/content.spec.ts` › "the editor autosaves a draft that survives a reload".

### 3. Schedule a post

1. Sets "Publish at" to a future time and submits; a moderator approves. → The post stays hidden until that time.
2. Clears the schedule. → It goes live at once.

**Extensions:**

- 1a. Approval after the chosen time: it publishes at approval.

**Tested by:** `e2e/content.spec.ts` › "a scheduled post stays hidden after approval until its publish time, and goes live when the schedule is cleared".

### 4. Edit, and restore an earlier version

1. Edits a post and saves. → The change is live (an approved post stays approved).
2. Opens "Revisions", picks an earlier version, restores it. → The post shows that version; the replaced one is now a revision too.

**Extensions:**

- 1a. Someone else's post: only its author and admins can edit; others get not found or forbidden.
- 1b. A rejected post edited by its author: it goes back to "Pending" for review (see [moderation.md](moderation.md)).

**Tested by:** `e2e/content.spec.ts` › "an edit keeps the previous version, which can be restored from the revision history".

### 5. Delete a post

1. Deletes their own post from My Posts. → It disappears for readers and from their list.

**Extensions:**

- 1a. Another author's post: not found for authors and moderators; admins can delete any post.

**Side effects:** soft delete: the record stays in the database, hidden everywhere (there is no restore in the app), and its images still count as used; pending review notifications for it are marked read.

**Tested by:** `e2e/moderation.spec.ts` › "an author deletes their own post, but not anyone else's".

## Rules and limits

- Images: JPEG, PNG, WebP, GIF; `UPLOAD_MAX_FILE_MB` per file (5), `UPLOAD_DAILY_LIMIT` per user per day (50), `UPLOAD_STORAGE_LIMIT_MB` per user (500), `UPLOAD_RATE_LIMIT_PER_HOUR` per address (30). Images over 50 megapixels are refused.
- Reading time: 200 words a minute.
- Loading states: the editor, edit, revisions and dashboard pages stream their own skeletons (`e2e/content.spec.ts` › "the editor and dashboard pages stream their own loading skeletons, not the posts grid").
