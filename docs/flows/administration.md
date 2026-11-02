# Administration

**Who:** admins (comment moderation also moderators). **Entry points:** the dashboard tabs "Users", "Categories", "Publish Requests", "Uploads", "All Posts" and "Comments".

## How it works

Admin pages sit under `/dashboard/admin/`, gated by role in `src/proxy.ts` before they render; their APIs check the same role through `withApiGuard` (`src/libs/api-guard.ts`). Users and roles: `PATCH /api/users/role/[id]`. Categories: `/api/categories` and `/api/categories/[id]`. Uploads: the report page reads `listUploads()` (`src/libs/upload-cleanup.ts`), which walks `UPLOAD_DIR` and checks every file against posts (deleted ones included), revisions and profile photos; `DELETE /api/uploads` and `GET /api/uploads/download` act on the selection. Publish requests and comment moderation have their own documents: [publish-requests.md](publish-requests.md), [moderation.md](moderation.md).

## Flows

### 1. Manage users and roles

1. Opens "Users", searches by name or email. → Matching users, paged.
2. Changes a user's role. → Saved; the user's access follows within a minute (new pages and APIs open or close).

**Extensions:**

- 2a. Their own role: "You can't change your own role".
- 2b. Demoting the last admin: "Can't demote the last remaining admin".

**Tested by:** `e2e/admin.spec.ts` › "an admin finds a user, changes their role, and the user's access follows".

### 2. Manage categories

1. Creates a category. → It appears in the list and in the editor's category choice.
2. Renames it. → The new name shows everywhere.
3. Deletes it after confirming. → Gone.

**Extensions:**

- 1a. An empty title: "Title is required". A name that already exists: "A category with this name already exists".
- 3a. Posts still use it: "Reassign or remove this category's posts first".

**Tested by:** `e2e/admin.spec.ts` › "an admin creates, renames and deletes categories, with clear refusals along the way".

### 3. Review and clean up uploads

1. Opens "Uploads". → Totals, then the unused files: preview, path, size, upload date, uploader, status, and details (dimensions, original size, and the original's camera, lens, software, time taken and location with a map link).
2. Downloads one file, the selection (a zip) or every unused file (a zip). → The files arrive; nothing changes on the server.
3. Deletes one file, the selection, or every unused file, after confirming. → They're removed from disk; a message says how many were deleted and how many kept.

**Extensions:**

- 1a. "All": every file, with in-use ones marked "In use".
- 3a. A file in use (post, deleted post, revision or profile photo): never deleted, even if selected; it's reported as kept.
- 3b. An unused file under a day old: marked "New" and kept, since it may be in a post that isn't saved yet.

**Side effects:** deleted files' records keep no photo metadata and expire after two days (they still count towards the uploader's daily limit until then).

**Tested by:** `e2e/uploads.spec.ts` › "an admin reviews unused uploads, downloads one or several, and deletes them one at a time or by selection".

### 4. Keep non-admins out

1. A reader, author or moderator opens an admin page or calls an admin API. → Redirected to My Posts, or a 403 from the API.

**Tested by:** `e2e/admin.spec.ts` › "non-admins can't reach admin pages or admin APIs".

## Rules and limits

- Admin-only: Users, Categories, Publish Requests, Uploads, All Posts. Moderators and above: Review Queue, Comments.
- The site always keeps at least one admin: the last admin can't be demoted or delete their account.
- Uploads report: 50 files per page; downloads of chosen files take up to 1000 at a time; zips stream one file at a time.
