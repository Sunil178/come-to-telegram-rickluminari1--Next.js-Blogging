# Votes

**Who:** signed-in users vote; everyone sees the counts. **Entry points:** the up and down arrows on post cards, post pages, comments and author profiles.

## How it works

One toggle covers posts, comments and author profiles (`src/libs/toggle-vote.ts`), behind `POST /api/posts/[slug]/vote`, `/api/comments/[id]/vote` and `/api/users/[username]/vote`. A vote record holds the user and the direction; clicking the same arrow again removes the vote, the other arrow switches it, and the target's `upvoteCount` and `downvoteCount` are adjusted in the same step. Upvote notifications are deduplicated per voter and target, so toggling a vote can't notify twice (`src/libs/notify.ts`).

## Flows

### 1. Vote on a post

**Preconditions:** signed in; a public post.

1. Chooses the up arrow. → It shows as pressed and the up count rises by one.
2. Chooses it again. → The vote is removed; the count drops back.
3. Chooses the down arrow, then the up arrow. → The vote switches; both counts change by one.
4. Reloads. → The pressed state and counts are what the clicks left.

**Side effects:** the post's author is notified of an upvote once (not for their own vote, and not again after toggling).

**Tested by:** `e2e/votes.spec.ts` › "a post vote toggles, switches sides and survives a reload with the right counts"; `e2e/notifications.spec.ts` › "an author sees upvotes on the notifications page and can switch them off".

### 2. Vote on a comment

1. Two readers upvote the same comment. → The count is 2; each sees their own arrow pressed.
2. One changes their vote. → Only their vote changes.

**Side effects:** the comment's author is notified of an upvote once.

**Tested by:** `e2e/votes.spec.ts` › "two readers' votes on a comment add up, and each reader can only change their own"; `e2e/notifications.spec.ts` › "an upvote on a reader's comment notifies the reader".

### 3. Vote on an author's profile

1. Opens an author's profile and votes. → The profile's counts change.

**Extensions:**

- 1a. Their own profile: "You can't vote on your own profile".

**Tested by:** `e2e/votes.spec.ts` › "readers vote on an author's profile, but nobody votes on their own".

### 4. Logged out

1. A visitor chooses an arrow. → Sent to sign in, then back to the same page.

**Tested by:** `e2e/votes.spec.ts` › "a logged-out visitor who votes is sent to log in and back".

## Rules and limits

- One vote per user per target; the direction is a boolean (up or down).
- Votes on posts or comments readers can't see are refused, except by their owner.
- Account deletion removes the user's votes and corrects every affected count (see [account-self-service.md](account-self-service.md)).
