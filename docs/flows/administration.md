# Administration

**Who:** admins (comment moderation also moderators). **Entry points:** the dashboard tabs "Messages", "Users", "Categories", "Publish Requests", "Uploads", "All Posts" and "Comments".

## How it works

Admin pages sit under `/dashboard/admin/`, gated by role in `src/proxy.ts` before they render; their APIs check the same role through `withApiGuard` (`src/libs/api-guard.ts`). Users and roles: `PATCH /api/users/role/[id]`; a user's details page reads `loadUserDossier()` (`src/libs/applicant.ts`), shared with the publish request review. Contact messages: `POST /api/contact` (anyone) and `PATCH /api/contact/[id]` (admins), stored in `ContactMessage`. Categories: `/api/categories` and `/api/categories/[id]`. Uploads: the report page reads `listUploads()` (`src/libs/upload-cleanup.ts`), which walks `UPLOAD_DIR` and checks every file against posts (deleted ones included), revisions and profile photos; `DELETE /api/uploads` and `GET /api/uploads/download` act on the selection. Publish requests and comment moderation have their own documents: [publish-requests.md](publish-requests.md), [moderation.md](moderation.md).

## Flows

### 1. Manage users and roles

1. Opens "Users", searches by name or email. → Matching users, paged, with the date each joined.
2. Opens a user. → Their details: name, role, join date, email and its verification, when they accepted the terms, post counts by status (shared posts only), comments and votes, uploads, requests to publish, sign-up and last sign-in addresses, the public profile and the private details (age and birth date, gender, phone, address).
3. Picks a new role from the list or the details page. → A confirmation names the user, the old and new role and what the new role can do; nothing changes until "Change role".
4. Confirms. → Saved; the user's access follows within a minute (new pages and APIs open or close).

**Extensions:**

- 2a. From a public author page, an admin also sees "All account details (admin only)", which opens the same details; nobody else sees it.
- 3a. "Cancel" or Escape: the role stays as it was.
- 4a. Their own role: the role button is disabled, and the API answers "You can't change your own role".
- 4b. Demoting the last admin: "Can't demote the last remaining admin".

**Tested by:** `e2e/admin.spec.ts` › "an admin finds a user, changes their role, and the user's access follows"; `e2e/contact-and-users.spec.ts` › "an admin opens a user from the list and sees every detail, private ones included".

### 2. Manage categories

1. Creates a category. → It appears in the list and in the editor's category choice.
2. Renames it. → The new name shows everywhere.
3. Deletes it after confirming. → Gone.

**Extensions:**

- 1a. An empty title: "Title is required". A name that already exists: "A category with this name already exists".
- 3a. Posts still use it: "Reassign or remove this category's posts first".

**Tested by:** `e2e/admin.spec.ts` › "an admin creates, renames and deletes categories, with clear refusals along the way".

### 3. Review and clean up uploads

1. Opens "Uploads". → Totals, then the unused files: preview, path, size, upload date, uploader (the seeder records the owner of its demo banners), status, and details (dimensions, original size, and the original's camera, lens, software, time taken and location with a map link).
2. Downloads one file, the selection (a zip) or every unused file (a zip). → The files arrive; nothing changes on the server.
3. Deletes one file, the selection, or every unused file, after confirming. → They're removed from disk; a message says how many were deleted and how many kept.

**Extensions:**

- 1a. "All": every file, with in-use ones marked "In use".
- 1b. An image only private posts use: shown as "Private" with its size and uploader, without preview, link or photo details, and left out of downloads (see [writing.md](writing.md) › "Keep a post private").
- 3a. A file in use (post, deleted post, revision or profile photo): never deleted, even if selected; it's reported as kept.
- 3b. An unused file under a day old: marked "New" and kept, since it may be in a post that isn't saved yet.

**Side effects:** deleted files' records keep no photo metadata and expire after two days (they still count towards the uploader's daily limit until then).

**Tested by:** `e2e/uploads.spec.ts` › "an admin reviews unused uploads, downloads one or several, and deletes them one at a time or by selection".

### 4. Answer contact messages

1. Opens "Messages". → Open messages, oldest first: reference, topic, date and age, sender's name, email (a reply link quoting the reference) and account, the reported link, and the text. A complaint open for 15 days or more is marked "Overdue".
2. Replies by email, then "Mark resolved". → It moves to "Resolved"; "Reopen" brings it back.

**Extensions:**

- 1a. A new message also reaches every admin as a notification ("Someone wrote through the contact form") and, when `CONTACT_EMAIL` is set, as an email to that address with replies going to the sender.
- 2a. Resolved messages are deleted a year after they were resolved.

**Tested by:** `e2e/contact-and-users.spec.ts` › "a visitor reports a post through the contact form, gets a reference by email, and an admin resolves it".

### 5. Keep non-admins out

1. A reader, author or moderator opens an admin page or calls an admin API. → Redirected to My Posts, or a 403 from the API.

**Tested by:** `e2e/admin.spec.ts` › "non-admins can't reach admin pages or admin APIs".

## Rules and limits

- Admin-only: Messages, Users, Categories, Publish Requests, Uploads, All Posts. Moderators and above: Review Queue, Comments.
- The site always keeps at least one admin: the last admin can't be demoted or delete their account.
- Uploads report: 50 files per page; downloads of chosen files take up to 1000 at a time; zips stream one file at a time.
