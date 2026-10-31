# Checklist — production readiness

**Current focus:** Final re-audit

Legend: `[ ]` pending · `[~]` in progress / done but uncommitted · `[x]` committed (date, hash)

## M1 Security — base `d394f58`, committed `421c26b`

Review round 1 (`/code-review high d394f58`): 10 findings. Fixed: login-limit race (reserve before bcrypt, refund on success), account-lockout DoS (account+IP 5/15 min plus account 50/h), successful logins no longer count per IP, auth wrapper only on gated paths (no Set-Cookie or role re-check on public pages), fail closed when `CLIENT_IP_HEADER` is missing, async bcrypt in registration, accurate rate-limit message, `isGatedPath` moved to `route-gates.ts`, checklist. Dismissed: every page rendering dynamically, which nonce CSP requires (documented in CLAUDE.md). Playwright: CSP with every script nonce'd and no violations (home, post, dashboard, editor); login lockout after 5 failures shows the message; admin login; logged-out and role redirects; isolated `blog_e2e` DB on port 5100.

- [x] SEC-01 dependency audit fixes: `npm audit fix` (DOMPurify 3.4.17); production deps audit clean
- [x] SEC-05 Next.js 16.4.3 (critical RCE advisories)
- [x] SEC-06 dev-only advisories accepted
- [x] SEC-02 rate-limit login (IP 20/15 min, account+IP 5/15 min, account 50/h; reserved before bcrypt) and registration (10/h per IP)
- [x] SEC-03 nonce-based CSP via `proxy.ts` on every page
- [x] SEC-04 client IP from the trusted proxy hop (`TRUSTED_PROXY_HOPS`) or `CLIENT_IP_HEADER` (fail closed)

## M2 Hygiene and docs — base `421c26b`, committed `c81b5d4` (M1 follow-ups) and `770ab7b`

Review round 1 (`/code-review high 421c26b`, covering M1 and M2): 10 findings. Fixed (M1 follow-ups): IPs that have signed into an account skip its account-wide cap (lockout DoS), IPv6 rate-limited per /64, client IP fails closed when the proxy chain is short or only `X-Real-IP` is present, login `callbackUrl` open redirect (`/\evil.com`) via `safeCallbackPath()`, constant-time login for unknown emails (dummy bcrypt), stale `config.matcher` wording in comments and docs, shared `consumePoint()` helper, static files skipped by the proxy matcher. Dismissed: the fail-closed shared `unknown` bucket (intended: only requests bypassing the proxy/CDN share it); refused attempts draining earlier buckets (intended; the trusted-IP exemption covers the lockout case); excluding prefetches from the proxy (would let a forged prefetch header fetch gated pages without the auth gate). Playwright: `/\example.org` callback lands on `/posts`; category dialog resets on reopen; no console errors; matcher skips static files and keeps CSP on pages.

- [x] DOC-01 `AGENTS.md` canonical, `CLAUDE.md` imports it; skill procedure moved to `docs/procedures/`
- [x] DOC-02 README rewritten
- [x] DOC-03 lint green (CategoryFormDialog, ESLint ignores, login autocomplete)
- [x] DOC-04 vote-route tests (22)
- [x] DOC-05 / DOC-06 / DOC-07 / DOC-08 deferred items documented in `docs/roadmap.md`

## M3 Ops — base `770ab7b`

Review round 1 (`/code-review high 770ab7b`): 10 findings. Fixed: e2e DB reset moved before `next start` (Playwright starts the web server before globalSetup, so the drop was wiping the server's indexes); logger never throws (cycle guard, BigInt) and keeps nested errors and `cause`, with native formatting in development; query string stripped from `onRequestError` paths; health check clears its timer, is rate-limited (60/min) and no longer exposes uptime; trusted-IP window 24 days (the in-memory store's setTimeout overflows past ~24.8 days, which had silently made the 30-day marker expire in 1 ms; regression test proven to fail on the old value); `withApiGuard` catch-all (logs, standard 500, `unstable_rethrow` for Next control flow); redirect test now checks the return after login; checklist. Dismissed: duplicate error output (Next prints its own error line regardless of `onRequestError`; no supported switch). Also: deprecated Mongoose `{ new }` option replaced by `returnDocument` everywhere; the bell button got an accessible name. E2E: 6/6 green on a production build with the isolated DB.

- [x] OPS-01 `GET /api/health` (DB ping, 503 when down, rate-limited)
- [x] OPS-02 structured logger (`src/libs/logger.ts`), all server `console.*` replaced
- [x] OPS-03 `onRequestError` in `src/instrumentation.ts`
- [x] OPS-04 Playwright suite (`npm run test:e2e`): register/login, wrong password, gated redirect and return, CSP, author → approval → public post, comment → author notification

## M4 Containers — base `4e13423`, committed `a305e7d`

Verification: image built with standalone output (non-root `node`, health-checked); e2e suite 7/7 against the container (`E2E_BASE_URL`) three times in a row, including an upload round-trip persisted to the `/app/uploads` volume. The bundled `mongo` image refuses to start on the host's kernel 7.0 (SERVER-121912), so the container ran against the host MongoDB's `blog_e2e`; documented in the README.

Review round 1 (`/code-review high 4e13423`): 10 findings, all fixed. `robots.txt` renders per request (it had been prerendered with the build-time `SITE_URL`); legacy `NEXT_PUBLIC_*` fallbacks are read by computed key (Next inlines literal accesses at build time, even on the server); the bell offers push only when the server configured VAPID successfully (`pushPublicKey()`); upload caching is `immutable` only for UUID names (seed banners and legacy files get 1 h); uploads are streamed; one image MIME allowlist in `src/libs/uploads.ts`; e2e uploads go to `.e2e-uploads/`, not the owner's `uploads/`; the e2e date regex accepts the unpadded date folders; the traversal e2e check targets a real image outside the root; Compose publishes MongoDB on loopback port 27018 and the README covers bootstrapping the first admin. Found while stabilizing e2e: comment and vote updates after an `await` left the transition, so a new comment briefly rendered twice and a vote briefly double-counted; both are re-wrapped in `startTransition`. E2E 7/7 on four consecutive runs.

- [x] OPS-05 Dockerfile (standalone output) + compose (app, mongo, Caddy `proxy` profile, Mailpit `mail` profile); runtime `SITE_URL` / `VAPID_PUBLIC_KEY` so one image fits every environment
- [x] DOC-09 uploads served by `src/app/uploads/[...path]/route.ts` from `UPLOAD_DIR` (traversal-safe, typed, immutable caching); machine-specific `public/uploads` symlink removed

## M5 Accounts — base `a305e7d`, committed `c0a64f7`

Review round 1 (`/code-review high a305e7d`): 10 findings, all fixed. Email-send limits are per account+IP (3/h) plus account-wide (10/h) with the login trusted-IP exemption, so a stranger can't block the owner's reset; email lookups (login, registration, resend, reset) are case-insensitive via collation; one live token per user and purpose in a single upsert (unique index), so concurrent sends can't leave an older link working; a login refused for an unverified email no longer refunds attempts or marks the IP trusted; verify and reset report a deleted account instead of claiming success, and reset is one pipeline update (bcrypt hash wrapped in `$literal`, since a pipeline reads a leading `$` as a field path); login banners go through `FormStatus` and never show success next to an error; one shared `escapeMarkup()` for the emails and RSS; e2e docs cover SMTP for `E2E_BASE_URL`. Also: Compose's Mailpit sets `MP_SMTP_DISABLE_RDNS`, because its reverse-DNS lookup of the Docker gateway delayed every SMTP greeting by 10 s.

- [x] ACC-01 email verification: `emailVerifiedAt` (explicit `null` = pending; legacy accounts without the field count as verified), required only when `SMTP_HOST` is set; login refuses unverified accounts after the password matched (`email_unverified`) and offers a resend; links open a confirm button (POST) so mail scanners can't use them up
- [x] ACC-02 password reset: forgot-password and reset pages; identical replies and timing for unknown emails (lookup and send in `after()`); 1 h one-time links; a reset completes pending verification and revokes older sessions through `passwordChangedAt` vs the JWT's `authAt` (within the 60 s recheck)
- Shared: `AuthToken` model (SHA-256 of a 256-bit token, TTL index, atomic find-and-delete), `src/libs/mailer.ts` (nodemailer 10.1.7 with file/URL access disabled; every release up to 10.1.3 carries high advisories, and Auth.js's optional peer range is overridden since its email provider isn't used), email sends limited to 10/h per IP and 3/h per account. E2E: 9/9 three times with Mailpit after the review fixes (verification with resend, reset with reuse refused, unknown email sends nothing).

## M6 Notifications v2 — base `c0a64f7`, committed `686a028`

Review round 1 (`/code-review high c0a64f7`): 10 findings, all fixed. Upvote dedupe is enforced by a unique partial index (`dedupe: true`), and a concurrent duplicate-key error counts as already notified; muted dedupe records carry no `readAt`, so the read TTL never removes them (visible upvote notifications can recur only after expiring); `notify()` builds push title, text and link from the catalogue (`NOTIFICATION_TITLES`, `describeNotification`, `notificationLink`), so callers pass context only; the bell's endpoint no longer pays for a total count; an out-of-range page redirects to the last page; a TTL under one hour is rejected (it would round to 0 s) and only NamespaceNotFound is ignored; TTL sync no longer blocks boot and backfills `readAt` only once, after the index is created; the notifications page tells the bell to refresh its badge; `sharp` is a pinned devDependency and the icon script resolves paths from its own location. E2E 11/11 (upvote dedupe, preferences hiding new upvotes, mark all read, manifest icons).

- [x] NTF-01 `/dashboard/notifications`: paginated history (20 per page), mark one or all read; the bell links to it; one catalogue (`src/libs/notification-types.ts`) describes and links every type for the bell, the page and push
- [x] NTF-02 per-category in-app and push switches (`User.notificationPrefs`, missing = on; `GET/PUT /api/notifications/preferences` accepts only known categories and booleans); with in-app off a deduplicated type keeps a hidden `muted` record so repeats stay silent
- [x] NTF-03 upvotes on posts and comments (deduplicated per voter and target, so toggling a vote can't re-notify), new publish requests to every admin, and the decision to the requester; `postId` is optional for notifications without a post
- [x] NTF-04 `readAt` set when read (not reset by repeat clicks); a TTL index synced at boot from `NOTIFICATION_READ_TTL_DAYS` (default 90, `0` drops it), changed in place with `collMod`; rows read before `readAt` existed start their clock at the first boot
- [x] NTF-05 192/512 PNG icons (plus maskable and Apple touch) generated from the "V." monogram by `src/scripts/generate-icons.mjs`; also the push notification icon (DOC-07 keeps the real-logo swap documented)

## M7 Content — base `686a028`, committed `001b797`

Review round 1 (`/code-review high 686a028`): 10 findings, all fixed. `GET /api/posts` (posts in every state with author emails, used by no UI) now requires moderator; an edit and its schedule change are one pipeline update (user text wrapped in `$literal`), so they can't disagree and unscheduled saves cost no extra write; restore snapshots the version it actually replaced (`findOneAndUpdate` before); `isScheduled` requires published and visible; related posts don't boost uncategorised posts; the editor no longer rewrites a draft after a successful save, fills the publish time after mount (browser timezone, no hydration mismatch), keeps autosaving while the restore banner is up, counts toolbar and click edits, and drops a stored draft identical to the saved post. E2E 15/15 twice (scheduling, revisions with restore, autosave restore and discard, related posts).

- [x] CNT-01 scheduled publishing: optional `publishAt` in the editor; approval sets `publishedAt` to the later of now and `publishAt` (pipeline update); editing an approved post's schedule moves it (clearing it publishes a still-scheduled post now); one rule (`src/libs/post-visibility.ts`) hides future `publishedAt` everywhere readers look (list, post, profile, home, sitemap, RSS, votes, comments, views); the dashboard marks scheduled posts
- [x] CNT-02 revision history: each edit snapshots the replaced version (`PostRevision`, last 20 per post, only when a revisioned field changed); `/posts/:slug/revisions` (gated, owner or admin) previews sanitized versions and restores one, keeping the replaced version too
- [x] CNT-03 autosaved drafts: the editor saves to `localStorage` per post a second after real input (not the initial content load), offers restore or discard on return, and clears the draft on a successful save
- [x] CNT-04 related posts: up to 3 public posts ranked by shared tags, then same category, then recency, below the post

## M8 Visitor interests — base `001b797` (committed with this checklist update)

Review round 1 (`/code-review high 001b797`, which also caught M7 issues in surrounding code): 10 findings, all fixed. Revision snapshots ignore Plate's per-load `data-block-id`s (unchanged saves no longer push real versions out) and run in `after()`; editor drafts are keyed per user (`src/libs/post-drafts.ts`) and cleared on logout; the undecided draft is parked under its own key while the restore banner is up, so autosaves can't overwrite it; the identical-draft check ignores node ids; restoring writes the draft back immediately; the publish-time field stays disabled until its client-side value is set (a fast edit could otherwise be overwritten); an author can no longer take a live post down by setting a future publish time (only not-yet-live posts move, and the field is locked on live posts); publish and password-change times use the app clock rather than MongoDB's `$$NOW`, matching the visibility and session checks; `tags` is indexed for related posts; revision times render in the viewer's timezone; the dashboard's "scheduled for" note shows only for pending posts. Found while testing: interest events were tied to the per-IP view counter, so readers sharing an address shared one event; they're now per visitor. E2E 17/17 three times (consent accept with event and stitching checked in the database, decline, cookie preferences).

- [x] VIS-01 anonymous visitor identity: an httpOnly random UUID cookie (`vid`, 1 year) issued only on consent; ids that aren't our UUIDs are ignored; unused `TempUser` / `UserInterest` models and `User.tempUserId` removed
- [x] VIS-02 interest events: `VisitorEvent` (`post_view`, 180-day TTL) recorded when a consenting visitor reads a public post, per visitor rather than per IP (readers behind one address keep separate interests), with the user id when signed in
- [x] VIS-03 identity stitching: login (Auth.js authorize) and registration attach the visitor's anonymous events to the account
- [x] VIS-04 consent banner: shown until the visitor chooses; Decline (or later withdrawal via the footer's "Cookie preferences") deletes the visitor cookie and its anonymous events; no cookie and no events without consent

## Final re-audit

- [ ] Re-audit and fix new Critical/High

## Progress

| Milestone | Done / total |
|---|---|
| M1 | 6 / 6 |
| M2 | 5 / 5 |
| M3 | 4 / 4 |
| M4 | 2 / 2 |
| M5 | 2 / 2 |
| M6 | 5 / 5 |
| M7 | 4 / 4 |
| M8 | 4 / 4 |

## Progress log

- 2026-10-31 — Initiative planned; findings, plan and checklist written.
- 2026-10-31 — M1 Security done and committed.
- 2026-10-31 — M2 Hygiene and docs done and committed.
- 2026-10-31 — M3 Ops done and committed.
- 2026-10-31 — M4 Containers, M5 Accounts, M6 Notifications v2 and M7 Content done and committed.
- 2026-10-31 — M8 Visitor interests done and committed.
