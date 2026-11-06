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

**Side effects:** post record (approval Pending); moderators get a "post waiting for review" notification; upload records with private metadata. A new image is a `draft` (loads by its address, never kept by shared caches) until a post is saved with it, then `public` once a shared post by its uploader uses it.

**Tested by:** `e2e/publishing.spec.ts` › "an author's post goes live only after a moderator approves it"; `e2e/uploads.spec.ts` › "an author's uploaded image is served back from /uploads", "a photo's location never reaches readers; its metadata stays private with the upload record".

### 2. Drafts survive a reload

1. Types in the editor, then reloads or closes the tab. → Reopening the editor offers the autosaved draft.
2. Logs out. → Every draft in this browser is cleared, so the next person on a shared computer doesn't see it.

**Tested by:** `e2e/content.spec.ts` › "the editor autosaves a draft, including its privacy, that survives a reload".

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

### 6. Keep a post private

**Preconditions:** signed in as an author or above.

1. Ticks "Private: only I can see this post" in the editor and saves ("Save privately"). → The post is in My Posts with a "Private" badge; opening it shows "Private post: only you can see it."
2. Later unticks it and saves (a restored draft keeps the box as it was). → The post goes to review like a new one, even if it was approved before it was made private: its content wasn't checked while private.

**Extensions:**

- 1a. A moderator or admin opens the post, its editor or its revisions: not found. It isn't in the review queue, the all-posts list or the admin comment list, and moderators can't approve, edit or delete it, or delete comments under it.
- 1b. Someone else requests one of its images: not found; the author gets them with `Cache-Control: private, no-store`. Admins see such files in Uploads only as "Private", without preview, details or download.
- 1c. A public post is made private: it disappears for readers at once, and its pending review notifications are marked read. Copies already saved can't be recalled: browsers, a CDN and the server's image-resizing cache can keep an image served while the post was public for up to a year.
- 1d. A private post shows no comment section; comments are for shared posts.
- 1e. Its banner is loaded directly, not through the image optimizer, whose server-side fetch carries no session and would be refused. The editor's banner preview is always loaded directly, so an image never lands in the optimizer's shared cache while its post is being written.
- 2a. An admin edits someone else's shared post: the checkbox isn't offered; only the author changes a post's privacy.
- 2b. A rejected post edited while it stays private keeps its rejection and the moderator's reason; nothing goes to review until it's shared.

**Side effects:** `visibility: false` on the post; its images' upload records set to `access: private` while only its author's private posts use them, recomputed for every image the post used before and after each save, restore or delete (`src/libs/upload-privacy.ts`). Someone else referencing a file can't make it public. No review notifications.

**Tested by:** `e2e/legal-and-private.spec.ts` › "a private post is visible only to its author, not to admins or the review queue", "a private post's banner and inline images reach only its author, and become public when it is shared"; `src/libs/post-page.test.ts`, `src/libs/upload-privacy.test.ts`, `src/app/uploads/[...path]/route.test.ts`, `src/app/api/uploads/download/route.test.ts`, `src/app/api/comments/[id]/route.test.ts`, `src/app/api/posts/[slug]/route.test.ts` › "private posts".

## Rules and limits

- Private posts: `visibility: false`. `SHARED_POST` and `manageablePostFilter()` in `src/libs/post-visibility.ts` keep them out of every moderator and admin query; a private post never matches `publicPostFilter()`, even when approved.
- Images: JPEG, PNG, WebP, GIF; `UPLOAD_MAX_FILE_MB` per file (5), `UPLOAD_DAILY_LIMIT` per user per day (50), `UPLOAD_STORAGE_LIMIT_MB` per user (500), `UPLOAD_RATE_LIMIT_PER_HOUR` per address (30). Images over 50 megapixels are refused.
- Reading time: 200 words a minute.
- Loading states: the editor, edit, revisions and dashboard pages stream their own skeletons (`e2e/content.spec.ts` › "the editor and dashboard pages stream their own loading skeletons, not the posts grid").
