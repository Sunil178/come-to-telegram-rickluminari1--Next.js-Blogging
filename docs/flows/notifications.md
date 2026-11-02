# Notifications

**Who:** every signed-in user receives them; which kinds depends on the role. **Entry points:** the bell in the navbar, "Notifications" in the dashboard (`/dashboard/notifications`), push messages from the browser.

## How it works

Events call `notify()` (`src/libs/notify.ts`), which writes an in-app notification and sends Web Push (`web-push`, VAPID keys) according to the recipient's per-category preferences. Nobody is notified of their own action, and upvote notifications are deduplicated per voter and target. Types and categories live in `src/libs/notification-types.ts`; staff review notifications are handled in `src/libs/review-notifications.ts`. The bell lists only unread notifications (the latest 20) with the unread count on each page, so anything read or already handled leaves it while the notifications page keeps the full history. It refreshes when a push message arrives in an open tab (`public/sw.js` posts a message to the page) or when notifications are marked read elsewhere in the tab, and an open notifications page shows items read from the bell as read. Read notifications expire through a MongoDB TTL index.

| Category | Types | Who gets them |
|---|---|---|
| Replies to your comments | comment_reply | anyone who comments |
| Comments on your posts | post_comment | authors |
| Upvotes on your posts and comments | post_upvoted, comment_upvoted | authors and commenters |
| Moderation decisions on your posts | post_approved, post_rejected | authors |
| Answers to your request to publish | publish_request_approved, publish_request_rejected | readers who applied |
| New requests to publish | publish_request | admins |
| Posts waiting for review | post_submitted | moderators and admins |

## Flows

### 1. See and open a notification

1. Something happens (a reply, an upvote, a decision). → The bell shows an unread badge on the next page load, or at once if push is on and a tab is open.
2. Opens the bell, chooses a notification. → It's marked read, leaves the bell, and the target opens (the comment on the post, the edit page of a rejected post, the request).
3. Chooses "Mark all read". → The badge clears and the bell says "You're all caught up."; the notifications page still lists them.

**Tested by:** `e2e/notifications.spec.ts` › "an upvote on a reader's comment notifies the reader"; `e2e/publishing.spec.ts` › "a reader's comment notifies the post's author"; `e2e/notifications.spec.ts` › "an author sees upvotes on the notifications page and can switch them off" (mark all read, caught up).

### 2. Notifications page and preferences

1. Opens "View all and settings". → Every notification, 20 per page, and a switch per category for in-app and push, showing only the categories the role can receive.
2. Turns a category's in-app switch off and saves. → "Notification preferences saved."; new events of that kind no longer appear.

**Tested by:** `e2e/notifications.spec.ts` › "an author sees upvotes on the notifications page and can switch them off".

### 3. Push notifications

1. Turns push on from the bell and allows the browser prompt. → Subscribed in this browser.
2. Another user comments on their post. → A system notification arrives even with the tab in the background; clicking it opens the comment.
3. Turns push off, or logs out. → The subscription is removed; nothing more arrives.

**Extensions:**

- 1a. The browser blocked notifications earlier: the bell explains how to allow them in the browser's site settings (a site can't reopen its own blocked prompt).
- 1b. No push support or no VAPID keys configured: the push switch isn't offered.

**Tested by:** `e2e/push.spec.ts` › "a reader's comment reaches the author as a real Web Push notification, until push is switched off" (Chrome and Edge projects).

### 4. Staff notifications follow the work

1. A post is submitted or a reader applies. → Every moderator (posts) or admin (requests) is notified.
2. One of them decides, or the author deletes the post. → Everyone's notification about it is marked read and leaves their bells; it stays on their notifications pages.

**Tested by:** `e2e/notifications.spec.ts` › "a reader's request to publish reaches the admins, and the approval reaches the reader".

## Rules and limits

- Read notifications are deleted after `NOTIFICATION_READ_TTL_DAYS` (default 90; 0 keeps them); unread ones are kept (`e2e/notifications.spec.ts` › "MongoDB's TTL monitor deletes old read notifications and keeps unread ones").
- Preferences: 30 saves a minute; push subscribe: 30 a minute per address. Push endpoints must belong to the browsers' known push services over HTTPS, so a subscription can't aim server requests at internal hosts (`src/libs/push-endpoint.ts`).
- The web app manifest offers installable PNG icons (`e2e/notifications.spec.ts` › "the web app manifest offers installable PNG icons").
