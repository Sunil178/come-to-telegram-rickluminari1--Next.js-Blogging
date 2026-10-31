# Checklist — production readiness

**Current focus:** M3 Ops

Legend: `[ ]` pending · `[~]` in progress / done but uncommitted · `[x]` committed (date, hash)

## M1 Security — base `d394f58`, committed `421c26b`

Review round 1 (`/code-review high d394f58`): 10 findings. Fixed: login-limit race (reserve before bcrypt, refund on success), account-lockout DoS (account+IP 5/15 min plus account 50/h), successful logins no longer count per IP, auth wrapper only on gated paths (no Set-Cookie or role re-check on public pages), fail closed when `CLIENT_IP_HEADER` is missing, async bcrypt in registration, accurate rate-limit message, `isGatedPath` moved to `route-gates.ts`, checklist. Dismissed: every page rendering dynamically, which nonce CSP requires (documented in CLAUDE.md). Playwright: CSP with every script nonce'd and no violations (home, post, dashboard, editor); login lockout after 5 failures shows the message; admin login; logged-out and role redirects; isolated `blog_e2e` DB on port 5100.

- [x] SEC-01 dependency audit fixes: `npm audit fix` (DOMPurify 3.4.17); production deps audit clean
- [x] SEC-05 Next.js 16.4.3 (critical RCE advisories)
- [x] SEC-06 dev-only advisories accepted
- [x] SEC-02 rate-limit login (IP 20/15 min, account+IP 5/15 min, account 50/h; reserved before bcrypt) and registration (10/h per IP)
- [x] SEC-03 nonce-based CSP via `proxy.ts` on every page
- [x] SEC-04 client IP from the trusted proxy hop (`TRUSTED_PROXY_HOPS`) or `CLIENT_IP_HEADER` (fail closed)

## M2 Hygiene and docs — base `421c26b`

Review round 1 (`/code-review high 421c26b`, covering M1 and M2): 10 findings. Fixed (M1 follow-ups): IPs that have signed into an account skip its account-wide cap (lockout DoS), IPv6 rate-limited per /64, client IP fails closed when the proxy chain is short or only `X-Real-IP` is present, login `callbackUrl` open redirect (`/\evil.com`) via `safeCallbackPath()`, constant-time login for unknown emails (dummy bcrypt), stale `config.matcher` wording in comments and docs, shared `consumePoint()` helper, static files skipped by the proxy matcher. Dismissed: the fail-closed shared `unknown` bucket (intended: only requests bypassing the proxy/CDN share it); refused attempts draining earlier buckets (intended; the trusted-IP exemption covers the lockout case); excluding prefetches from the proxy (would let a forged prefetch header fetch gated pages without the auth gate). Playwright: `/\example.org` callback lands on `/posts`; category dialog resets on reopen; no console errors; matcher skips static files and keeps CSP on pages.

- [x] DOC-01 `AGENTS.md` canonical, `CLAUDE.md` imports it; skill procedure moved to `docs/procedures/`
- [x] DOC-02 README rewritten
- [x] DOC-03 lint green (CategoryFormDialog, ESLint ignores, login autocomplete)
- [x] DOC-04 vote-route tests (22)
- [x] DOC-05 / DOC-06 / DOC-07 / DOC-08 deferred items documented in `docs/roadmap.md`

## M3 Ops

- [ ] OPS-01 health route
- [ ] OPS-02 structured logging
- [ ] OPS-03 onRequestError
- [ ] OPS-04 Playwright e2e

## M4 Containers

- [ ] OPS-05 Dockerfile + compose (+ Caddy, Mailpit)

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
| M3 | 0 / 4 |
| M4 | 0 / 1 |
| M5 | 0 / 2 |
| M6 | 0 / 5 |
| M7 | 0 / 4 |
| M8 | 0 / 4 |

## Progress log

- 2026-10-31 — Initiative planned; findings, plan and checklist written.
- 2026-10-31 — M1 Security done and committed.
- 2026-10-31 — M2 Hygiene and docs done and committed.
