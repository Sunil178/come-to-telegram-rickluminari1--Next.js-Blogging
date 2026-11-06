# Publish requests

**Who:** readers apply to become authors; admins review. **Entry points:** "Request to publish" on My Posts (`/dashboard/posts`), the admin's "new request" notification, "Publish Requests" (`/dashboard/admin/requests`) and each request's review page (`/dashboard/admin/requests/[id]`).

## How it works

The application form (`src/components/dashboard/RequestPublishButton.tsx`) is prefilled from the reader's profile; `POST /api/publish-requests` validates it (`src/libs/publish-application.ts`), saves the profile fields back to the profile, creates the request and records the address it came from after the response. A unique partial index allows one pending request per user. The admin review page (`src/libs/applicant.ts`) shows the application, account activity, the sign-up, last sign-in and request addresses with their approximate locations (`src/libs/geoip.ts`, DB-IP City Lite), and the public and private profile. A decision through `PATCH /api/publish-requests/[id]` changes the role on approval, notifies the reader, and marks the admins' request notifications read.

## Flows

### 1. Apply

**Preconditions:** signed in as a reader.

1. Chooses "Request to publish". → A form prefilled from their profile: why they want to write, a writing sample, headline, bio, website, links, expertise, topics.
2. Fills it in and sends. → "Your request to publish is pending review.", and it still says so after a reload.

**Extensions:**

- 2a. Motivation under 20 or over 2000 characters, a sample under 100 or over 10000, or an invalid profile field: the form says what to fix.
- 2b. A second request while one is pending: "You already have a pending request".

**Side effects:** request record with the motivation, sample and request address; profile fields updated; every admin is notified.

**Tested by:** `e2e/notifications.spec.ts` › "a reader's request to publish reaches the admins, and the approval reaches the reader"; `e2e/profile.spec.ts` › "an applicant's form saves to their profile, and the admin reviews the full application with addresses before approving".

### 2. Review and approve

**Preconditions:** signed in as an admin; a pending request.

1. Opens "Publish Requests". → Pending requests with where each came from; each row links to its review page.
2. Opens a request. → Application, then the same details as the user's page under "Users": account and activity (email verification, terms acceptance, posts, comments and votes, uploads, earlier requests), addresses with locations, public profile and private details (age).
3. Approves and confirms "Make <username> an author?". → The user becomes an author. On My Posts the reader sees "Your request was approved. Writing unlocks within a minute; reload then." (the session picks up the new role at its next check).

**Extensions:**

- 2a. A non-admin opens a review page: redirected away (the role gate runs before the page).
- 2b. An address with no location (private network, or no geolocation file): "Unknown location"; nothing recorded: "Not recorded".
- 3a. "Cancel" in the confirmation: nothing changes.

**Side effects:** role change; the reader is notified; admins' notifications about the request are marked read.

**Tested by:** `e2e/profile.spec.ts` › "only admins can open an applicant's review page"; `e2e/notifications.spec.ts` › "a reader's request to publish reaches the admins, and the approval reaches the reader".

### 3. Decline, and apply again

1. The admin rejects the request and confirms. → "Request rejected."
2. The reader is notified and opens My Posts. → "Your last request was declined." and a "Request again" button.
3. Applies again. → Pending again.

**Tested by:** `e2e/notifications.spec.ts` › "a declined reader is told, sees why the button changed, and can ask again".

## Rules and limits

- One pending request per user (unique partial index).
- Motivation 20 to 2000 characters; writing sample 100 to 10000.
- The "approved" message shows on My Posts for 5 minutes after the decision.
- Addresses and locations are kept for as long as the account exists and shown only to admins (see the privacy page).
