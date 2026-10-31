# Project review — 2026-10-31

Scope: understanding of the entire repo, plus a code review and a security review of the **staged change set** (in-app notifications + Web Push, 32 files, +1433/−22). Code that is already committed was checked only lightly. It went through a full security audit in `ff267bb`, and this pass looked for regressions and structural gaps.

## 1. What the project is

Vedev.Guru Blog is a multi-author blogging platform.

- **Stack:** Next.js 16.3 (App Router, Turbopack, `proxy.ts` instead of `middleware.ts`), React 19.2, TypeScript 6, Tailwind 4 + shadcn/Radix, Plate.js 53 rich-text editor, Mongoose 9 on MongoDB, NextAuth v5 (Credentials, JWT sessions), Vitest 4.
- **Roles:** reader → author → moderator → admin (`src/libs/roles.ts`). The JWT re-checks the role against the DB every 60 s (`src/auth.config.ts`).
- **Request-level policy:** every Route Handler is wrapped in `withApiGuard` (`src/libs/api-guard.ts`), which handles auth (on by default), minimum role, and per-IP in-memory rate limiting. Whole-page gates live in `src/proxy.ts`, which covers `/posts/add`, `/posts/:slug/edit` and `/dashboard/*`, with per-prefix role minimums.
- **DB connection:** opened once at server boot via `src/instrumentation-node.ts`. Only the seeder and the bootstrap-admin script connect on their own.
- **Domain:**
  - posts with draft → pending → approved/rejected approval and publish requests
  - categories and tags
  - threaded soft-deletable comments
  - votes on posts, comments and users
  - deduplicated, rate-limited page views
  - SEO plumbing: sitemap, robots, RSS, OG images
  - (staged) notifications and Web Push
- **Content safety:** post HTML is sanitized server-side with DOMPurify (JSDOM) before `dangerouslySetInnerHTML` (`src/app/posts/[slug]/page.tsx:123`).
- **Admin:** dashboard pages for users and roles, categories, publish requests, all posts, approval and comment moderation.

## 2. Baseline health (staged tree)

| Check | Result |
|---|---|
| `vitest run` | 22 files, **95/95 pass** |
| `tsc --noEmit` | clean |
| `eslint .` | 2 errors, 4 warnings. Both errors are the same pre-existing `react-hooks/set-state-in-effect` in `src/components/dashboard/admin/CategoryFormDialog.tsx:32`, reported twice because ESLint also scans `.kilo/worktrees/` |

## 3. Staged changes — verdict

**Not ready to commit yet.** The design is sound: `after()` keeps notify off the response path, push degrades to in-app-only, there are no self-notifications and no duplicate when the parent author is also the post author, and the tests cover the routes. Items 1–3 below are real user-facing bugs, and S1 is a security gap. All are small fixes.

### Correctness (from `/code-review`, verified against the code)

1. **Logout can hang forever.** `src/libs/push-subscription.ts:93`: `getExistingSubscription` awaits `navigator.serviceWorker.ready`, which never resolves when no SW is registered (registration failed, sw.js blocked, private mode). `LogoutButton.tsx:22` awaits `unsubscribeFromPush()` before `signOut`. Fix: use `navigator.serviceWorker.getRegistration()`.
2. **Bad VAPID config crashes comments and approval.** `src/libs/notify.ts:8-13`: `setVapidDetails` runs at import and throws on malformed keys. Copying `.env.example` as-is (placeholder strings are non-empty) makes the comments and approval routes 500. Fix: wrap it in try/catch and set `pushConfigured = false`.
3. **Push subscription stays bound to the previous user on a shared browser.** `NotificationBell.tsx:91` only reads the existing browser subscription and never re-POSTs it. If user A's logout unsubscribe failed or their session expired, user B sees "push enabled" but A's notifications arrive on B's screen. Fix: re-send `subscription.toJSON()` to `/api/push/subscribe` on mount (the upsert by endpoint already reassigns `userId`).
4. **Duplicate approval notifications.** `approval/route.ts:31`: every PATCH notifies, even when the status didn't change (double click, or two moderators). Fix: filter `{ slug, approval: { $ne: approval } }`, or compare with the pre-update document.
5. **`pushsubscriptionchange` fallback is broken.** `public/sw.js:23-31`: it re-subscribes without `applicationServerKey` (rejects when `oldSubscription` is null, which is common in Firefox) and ignores a 401 from `/api/push/subscribe` before unregistering the old endpoint.
6. **`notificationclick` focuses the wrong tab.** `public/sw.js:56`: `c.url.includes(url)` with the `/` fallback matches every tab. It also never navigates the focused tab, and URLs with a hash never match. Fix: compare normalized URLs and call `client.navigate(url)`.
7. **Malformed id returns 500.** `notifications/[id]/read/route.ts:11`: a non-ObjectId id throws CastError and returns 500. Add an `isValidObjectId` check and return 400.
8. **Index doesn't serve the list query.** `src/models/Notification.ts:29`: `{recipientId, read, createdAt}` can't supply the sort for `find({recipientId}).sort({createdAt:-1})`. Add `{ recipientId: 1, createdAt: -1 }`, and consider a TTL on old read notifications.
9. **One hashchange listener per comment.** `CommentItem.tsx:57`: 300 comments mean 300 listeners. Move it to `CommentSection`.
10. **`push` handler can crash.** `public/sw.js:3`: `event.data.json()` is unguarded, so a non-JSON payload throws and no notification is shown.

### Security (manual review; the `/security-review` skill needs an `origin` remote, which this repo lacks)

- **S1 — Blind SSRF via push endpoint (Medium).** `src/app/api/push/subscribe/route.ts:8` accepts any string as `endpoint`, and `notify()` makes the server POST to it via `web-push`. A logged-in reader can register `http://169.254.169.254/...` or an internal host. A second account replying to them, or a moderator approving their post, then triggers server-side requests. Fix: require `https:` and an allowlist of push-service hosts (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.notify.windows.com`, `web.push.apple.com`), plus length caps on endpoint and keys.
- **S2 — Notification amplification (Low–Medium).** `POST /api/posts/[slug]/comments` has no `rateLimit`, and each comment now fans out a DB write plus a push to every subscription of the post author. There is also no cap on subscriptions per user. Fix: add `rateLimit` to the comment POST and `/api/push/subscribe`, and cap subscriptions per user (e.g. 10, evicting the oldest).
- **S3 — Endpoint re-binding (Low, informational).** The subscribe upsert by `endpoint` overwrites `userId`. That is fine because endpoints are unguessable capability URLs, and the behavior is useful for fix 3. Keep it, but don't log endpoints.
- No issues found in: notification ownership scoping (all queries are filtered by `recipientId` from the session), unsubscribe scoping (`userId` in the filter), XSS (React-escaped text, OS notifications are plain text), or `Cache-Control` on `/sw.js`.

## 4. Whole-repo observations (committed code)

- `README.md` is still the create-next-app boilerplate and points to port 3000. Replace it with setup instructions: env vars, `npm run seed`, `bootstrap-admin`, port 5000, VAPID keys.
- No `AGENTS.md`. Your global rules say `AGENTS.md` is canonical and `CLAUDE.md` should start with `@AGENTS.md`.
- `.claude/memory/` (the repo mirror of memories) did not exist; it is created by this session.
- ESLint scans `.kilo/` and `.worktrees/`. Add `globalIgnores([".kilo/**", ".worktrees/**", "uploads/**"])` to `eslint.config.mjs`.
- The rate limiter is in-memory (documented). It doesn't survive restarts or scale past one instance.
- `getClientIp` trusts `X-Forwarded-For` (documented). This is safe only behind a proxy that overwrites the header, so it needs to be a deployment requirement in the README.
- A few `.js` files remain in a TS codebase (`src/app/page.js`, `src/models/TempUser.js`, `UserInterest.js`, `src/libs/helpers.js`, `[...nextauth]/route.js`). `TempUser` and `UserInterest` look unused; verify and delete, or convert.
- Uploads go to the local `uploads/` disk, which breaks on serverless or multi-instance hosting.
- Routes without tests: the vote routes (`posts/[slug]/vote`, `comments/[id]/vote`, `users/[username]/vote`).

## 5. Recommended next steps (in order)

1. Fix S1, S2 and correctness items 1–4 on the staged set, plus 5–8 (all small). Then add tests: endpoint allowlist, idempotent approval, invalid id → 400.
2. Re-run `/code-review` on the fixes, then commit as one `feat: in-app notifications with Web Push` commit.
3. Housekeeping commit: ESLint ignores plus the `CategoryFormDialog` fix (lint goes green), README rewrite, `AGENTS.md`.

## 5a. Resolution of section 3 (uncommitted, awaiting approval)

All section-3 items are fixed on top of the staged set, together with the follow-up `/code-review high HEAD` findings:

- **S1:** `src/libs/push-endpoint.ts` allowlist (https, known push-service hosts, no port or userinfo, ≤2048 chars). It is enforced at subscribe time and again in `notify()` for rows stored earlier.
- **S2:** comment POST is rate-limited to 10/min. Subscribe is rate-limited to 30/min and capped at 10 subscriptions per user (oldest evicted). Concurrent-upsert E11000 is retried, and an unchanged re-sync costs one indexed read.
- **1:** uses `getRegistration()` instead of `serviceWorker.ready`.
- **2:** VAPID setup is wrapped and degrades to in-app only.
- **3:** the bell re-syncs the existing subscription on mount, and the server re-binds the endpoint to the current user.
- **4:** approval reads the pre-update document. Notifications go out only on a status change, and re-approving still publishes.
- **5, 6, 10:** the SW reads the VAPID key from its registration URL, checks the save response, and claims clients. On click it focuses first and marks read in parallel. A same-page target reloads so the new comment is present. A non-JSON push falls back to a plain-text notification.
- **7:** new `withApiGuard` option `objectIdParams`, applied to all 7 `[id]` handlers. The comment POST also validates `parentId`.
- **8:** indexes `{recipientId, createdAt}` and `{recipientId, read}`.
- **9:** one hashchange listener in `CommentSection`.
- **Push toggle:** hidden when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is unset.
- **Accepted (S3 / review item 8):** whoever knows an endpoint can re-bind it. Endpoints are unguessable capability URLs, and re-binding is what makes the shared-browser fix work.

Verification: `vitest` 113/113, `tsc` clean, ESLint shows only the older `CategoryFormDialog` error, and `next build` passes.

### Build-time MongoDB failure (fixed)

- **Root cause:** Next skips `instrumentation.register()` during `next build` (`registerInstrumentation()` returns early when `NEXT_PHASE === "phase-production-build"`, `next/dist/server/lib/router-utils/instrumentation-globals.external.js`), and the build docs state that database calls aren't available while prerendering. `src/app/sitemap.ts` exported `revalidate = 3600`, which made it ISR, so it was prerendered at build. It was the only DB-reading route that gets prerendered; every other one uses request-time APIs or is an uncached GET handler. Mongoose buffered the query with no connection and timed out after 10 s.
- **Fix:** the sitemap calls `await connection()` from `next/server`, the documented way to render at request time, and the `revalidate` export is removed. The rule is now in `CLAUDE.md` under "Database connection".
- **Verified:** with `next start`, `/sitemap.xml` returns 29 URLs (2 static + 27 posts, matching the feed's 27 items), and instrumentation connects at server boot.

### Production auth (fixed)

Found while verifying with `next start`: Auth.js trusts the request host only when `AUTH_URL`, `AUTH_TRUST_HOST`, `VERCEL` or `CF_PAGES` is set, or outside production (`@auth/core/lib/utils/env.js`). Self-hosted production therefore failed every `/api/auth/session` call with `UntrustedHost`. `.env.example` now documents `AUTH_URL`. With it set, the session endpoint returns 200 and no errors are logged.

### Second review gate

- **Fixed:**
  - the subscription cap evicted active devices; `updatedAt` now works as a "last seen" time, refreshed at most daily
  - subscriptions made with a rotated VAPID key are replaced on the next page load
  - the manifest referenced PNG icons that don't exist; it now lists `/icon.ico` with its real sizes
  - a push with no title showed "undefined"
- **Accepted:**
  - endpoint re-binding (see S3)
  - the rate limit is per IP and checked before auth, as `withApiGuard` is designed
  - a same-page notification click in a tab without a mounted bell only focuses the tab
  - same-page targets reload the page instead of syncing `CommentSection` state from fresh props
  - the existing `Promise.resolve().then(...)` effect pattern
- **Open:**
  - no TTL on notifications (a retention decision; listed under enhancements)
  - real 192/512 PNG icons for the install prompt

Not browser-tested: the SW and bell flows (push delivery, notification click, shared-browser re-bind) need a manual check in Chrome and Firefox with real VAPID keys.

## 6. Enhancement ideas

- **Notifications:** a TTL index on `createdAt` (e.g. 90 days) to bound storage, a full `/dashboard/notifications` page with pagination, per-type preferences (mute votes/comments), an email digest fallback, and notifications for votes and publish-request decisions.
- **Content:** scheduled publishing, revision history for posts, autosaved drafts, image optimization via `next/image` with a remote loader, and an object-storage upload backend (S3/R2).
- **Discovery:** related posts by tag, MongoDB text or Atlas Search ranking, author follow and personalized feed, and per-post JSON-LD structured data.
- **Ops:** a Redis-backed rate limiter and session-safe multi-instance deploy, a health-check route, structured logging, a CI workflow (lint + tsc + vitest), Playwright smoke tests for login, post, comment and approval.
- **Security:** a CSP header (nonce-based, since the post body renders HTML), account lockout and login rate limiting, email verification (the `TempUser` model hints this was planned), and `npm audit` in CI.
