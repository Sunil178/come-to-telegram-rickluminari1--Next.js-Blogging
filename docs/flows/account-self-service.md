# Account self-service

**Who:** every signed-in user. **Entry points:** "Account" in the avatar menu and the dashboard menu (`/dashboard/account`), "Privacy" in the footer (`/privacy`).

## How it works

The account page (`src/app/dashboard/account/page.tsx`) shows one card per section (`src/components/account/AccountCard.tsx`): photo, public profile, private details (one form, saved together), change password, data export and account deletion. Profile input is validated in one place (`src/libs/profile.ts`) and saved by `PATCH /api/account/profile`; the photo goes through `POST`/`DELETE /api/account/avatar`, which strips its metadata like every upload (see [writing.md](writing.md)). Public profile fields show on `/users/[username]`; private details are visible only to the user and admins. Export and deletion live in `src/libs/account-data.ts`.

## Flows

### 1. Fill in the profile and photo

**Preconditions:** signed in.

1. Opens Account, uploads a photo. → "Photo updated."; the avatar changes everywhere.
2. Fills in the public profile (headline, bio, country, city, website, other links, expertise, topics, education) and private details (date of birth, gender, phone, address), saves. → "Profile saved."
3. Opens their author page. → The public part shows; the private part doesn't.

**Extensions:**

- 1a. Not an image, a forged type or over the size limit: a toast says why; nothing changes.
- 1b. "Remove photo": the photo goes, and its file is deleted once nothing else uses it.
- 2a. A website or link that isn't a full `http(s)://` address, a phone with letters, a date of birth under 13 or impossible (2001-02-30), or text over its limit: the form shows what to fix and nothing is saved.

**Side effects:** profile fields on the user record; replaced photos removed from disk.

**Tested by:** `e2e/profile.spec.ts` › "a user fills in their profile; the public part shows on their author page and the private part doesn't".

### 2. Change password

**Preconditions:** signed in.

1. Enters the current password and a new one twice, chooses "Change password". → Signed out and sent to sign-in with a notice; only the new password works.

**Extensions:**

- 1a. Wrong current password, the same password again, a mismatch or under 8 characters: an error, nothing changes.

**Side effects:** `passwordChangedAt` set, so every other browser is signed out within a minute; push and drafts in this browser are cleared like a logout.

**Tested by:** `e2e/profile.spec.ts` › "a user changes their password, is signed out, and only the new password works".

### 3. Download my data

1. Chooses "Download my data". → A JSON file with the profile, posts and revisions, comments, votes, notifications, push subscriptions (dates only), requests to publish, reading history and uploads with their photo metadata; never the password hash.

**Tested by:** `e2e/account.spec.ts` › "a reader downloads their data without the password hash".

### 4. Delete the account

1. Chooses "Delete my account…", confirms with their password, chooses "Permanently delete account". → "Your account has been deleted."; signed out.

**Extensions:**

- 1a. Wrong password: refused, nothing deleted.
- 1b. The last admin: refused, so the site always keeps an admin.

**Side effects:** their posts, revisions, votes, notifications, push subscriptions, tokens, requests, reading history and upload records are deleted; their comments under other people's posts become "[deleted]" placeholders so replies keep their thread; vote and comment counters on other content are corrected; their uploaded files are deleted unless another post uses them.

**Tested by:** `e2e/account.spec.ts` › "deleting an account removes its content, keeps reply threads and corrects vote counts".

### 5. Read the privacy policy

1. Opens "Privacy" from any page's footer. → What is stored and why, cookies and browser storage, retention, and how to export or delete.

**Tested by:** `e2e/account.spec.ts` › "the privacy policy is linked from every page and explains the cookies".

## Rules and limits

- Profile: headline 120, bio 2000, country and city 80, education and address 300, gender 40 characters; up to 5 links (one per line), 10 expertise and 10 topics (comma-separated); date of birth makes the user 13 to 120.
- Rate limits: profile saves 30 a minute; password changes 5 per 15 minutes; export 5 an hour; deletion 5 per 15 minutes; photo uploads `UPLOAD_RATE_LIMIT_PER_HOUR` (30).
