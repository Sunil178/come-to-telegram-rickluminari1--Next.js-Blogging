# Checklist — production readiness

**Current focus:** M4 Containers

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

## M4 Containers — base `4e13423`

Verification: image built with standalone output (non-root `node`, health-checked); e2e suite 7/7 against the container (`E2E_BASE_URL`) three times in a row, including an upload round-trip persisted to the `/app/uploads` volume. The bundled `mongo` image refuses to start on the host's kernel 7.0 (SERVER-121912), so the container ran against the host MongoDB's `blog_e2e`; documented in the README.

Review round 1 (`/code-review high 4e13423`): 10 findings, all fixed. `robots.txt` renders per request (it had been prerendered with the build-time `SITE_URL`); legacy `NEXT_PUBLIC_*` fallbacks are read by computed key (Next inlines literal accesses at build time, even on the server); the bell offers push only when the server configured VAPID successfully (`pushPublicKey()`); upload caching is `immutable` only for UUID names (seed banners and legacy files get 1 h); uploads are streamed; one image MIME allowlist in `src/libs/uploads.ts`; e2e uploads go to `.e2e-uploads/`, not the owner's `uploads/`; the e2e date regex accepts the unpadded date folders; the traversal e2e check targets a real image outside the root; Compose publishes MongoDB on loopback port 27018 and the README covers bootstrapping the first admin. Found while stabilizing e2e: comment and vote updates after an `await` left the transition, so a new comment briefly rendered twice and a vote briefly double-counted; both are re-wrapped in `startTransition`. E2E 7/7 on four consecutive runs.

- [~] OPS-05 Dockerfile (standalone output) + compose (app, mongo, Caddy `proxy` profile, Mailpit `mail` profile); runtime `SITE_URL` / `VAPID_PUBLIC_KEY` so one image fits every environment
- [~] DOC-09 uploads served by `src/app/uploads/[...path]/route.ts` from `UPLOAD_DIR` (traversal-safe, typed, immutable caching); machine-specific `public/uploads` symlink removed

## M5 Accounts

- [ ] ACC-01 email verification
- [ ] ACC-02 password reset

## M6 Notifications v2

- [ ] NTF-01 notifications page
- [ ] NTF-02 preferences
- [ ] NTF-03 vote + publish-request notifications
- [ ] NTF-04 configurable read TTL
- [ ] NTF-05 generated icons (DOC-07 documented)

## M7 Content

- [ ] CNT-01 scheduled publishing
- [ ] CNT-02 revision history
- [ ] CNT-03 autosaved drafts
- [ ] CNT-04 related posts

## M8 Visitor interests

- [ ] VIS-01 visitor identity
- [ ] VIS-02 interest events
- [ ] VIS-03 identity stitching
- [ ] VIS-04 consent banner

## Final re-audit

- [ ] Re-audit and fix new Critical/High

## Progress

| Milestone | Done / total |
|---|---|
| M1 | 6 / 6 |
| M2 | 5 / 5 |
| M3 | 4 / 4 |
| M4 | 0 / 1 |
| M5 | 0 / 2 |
| M6 | 0 / 5 |
| M7 | 0 / 4 |
| M8 | 0 / 4 |

## Progress log

- 2026-10-31 — Initiative planned; findings, plan and checklist written.
- 2026-10-31 — M1 Security done and committed.
- 2026-10-31 — M2 Hygiene and docs done and committed.
- 2026-10-31 — M3 Ops done and committed.
