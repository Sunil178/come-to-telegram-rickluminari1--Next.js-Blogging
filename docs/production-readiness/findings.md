# Findings — production readiness

Append-only. Fixed items are not edited; new discoveries are appended with a date. Status lives in `checklist.md`.

Severity: Critical / High / Medium / Low / Feature.

## Security (SEC)

- **SEC-01 — High — vulnerable dependencies.** `npm audit --omit=dev` (2026-10-31) reports `dompurify` ≤3.4.16 (critical; it is the sanitizer for post HTML rendered with `dangerouslySetInnerHTML` in `src/app/posts/[slug]/page.tsx`), `immutable` via sass (high), and `@platejs/core`, `ip-address`, `baseline-browser-mapping` (moderate). Fix: `npm audit fix` (no `--force`), re-run tests and build.
- **SEC-02 — High — no brute-force protection on login or registration.** The NextAuth credentials `authorize()` and the `register` server action have no rate limit. Fix: per-IP limits on both, sharing the limiter used by `withApiGuard`.
- **SEC-03 — Medium — no Content-Security-Policy.** Post bodies render sanitized HTML; a CSP is the second layer. Fix: nonce-based CSP set in `src/proxy.ts`, per the Next.js CSP guide.
- **SEC-04 — Medium — spoofable client IP.** `getClientIp` (`src/libs/client-ip.ts`) trusts the first `X-Forwarded-For` entry, which the client controls even behind most proxies, so every per-IP rate limit can be bypassed. Fix: trust only proxy-added hops (`TRUSTED_PROXY_HOPS`) or a named header (`CLIENT_IP_HEADER`, e.g. `cf-connecting-ip`).

- **SEC-05 — Critical — Next.js 16.3.1 has unauthenticated RCE advisories** (appended 2026-10-31, found while fixing SEC-01): image optimizer (SVG/AVIF), `use cache` typed arrays, `next/og`, plus SSRF, cache poisoning and a Server Actions DoS. Fix: upgrade `next` and `eslint-config-next` to 16.4.3.
- **SEC-06 — Low — remaining dev-only advisories** (appended 2026-10-31): `deepmerge` via the `shadcn` CLI, `minimatch` via ESLint, `postcss-selector-parser` via `@tailwindcss/typography`; fixes need breaking `--force` upgrades. Production dependencies audit clean; accepted until those tools release compatible fixes.

## Hygiene and docs (DOC)

- **DOC-01 — Medium — no `AGENTS.md`.** The tool-neutral instruction file is missing; `CLAUDE.md` holds everything. Fix: move content to `AGENTS.md`, make `CLAUDE.md` import it.
- **DOC-02 — Medium — README is create-next-app boilerplate** (wrong port, no setup). Fix: real setup, env, scripts, deployment requirements.
- **DOC-03 — Low — lint is red.** `react-hooks/set-state-in-effect` in `src/components/dashboard/admin/CategoryFormDialog.tsx:32`; ESLint also scans `.kilo/` and `.worktrees/`.
- **DOC-04 — Low — vote routes untested.** `posts/[slug]/vote`, `comments/[id]/vote`, `users/[username]/vote` have no tests.
- **DOC-05 — Deferred — upload storage.** Uploads are written to local `uploads/` via `fs.writeFileSync`; breaks on serverless/multi-instance. Document; implement later (S3/R2 or persistent volume).
- **DOC-06 — Deferred — in-memory rate limiter.** Resets on restart, not shared across instances. Document; move to Redis when scaling past one instance.
- **DOC-07 — Deferred — PWA icons.** The install prompt needs real 192×192 and 512×512 PNGs from the owner's logo; generated placeholders ship in M6.
- **DOC-08 — Deferred — GitHub Actions CI/CD.** Workflow design documented; not added yet.

## Ops (OPS)

- **OPS-01 — Medium — no health check.** Add `/api/health` (process up + DB ping) for containers and uptime monitors.
- **OPS-02 — Medium — unstructured logging.** `console.*` everywhere. Add a small structured logger (JSON in production).
- **OPS-03 — Medium — no server error reporting.** Add `onRequestError` in `src/instrumentation.ts`, logging through OPS-02.
- **OPS-04 — Medium — no end-to-end tests.** Add Playwright smoke tests: register/login, create post, approval, comment, against an isolated database.
- **OPS-05 — Medium — no container support.** Add `Dockerfile` (standalone output), `docker-compose.yml` (app, mongo, optional Caddy, Mailpit for dev).

## Accounts (ACC)

- **ACC-01 — Feature — email verification.** Verify email on registration via a one-time, expiring token sent over SMTP.
- **ACC-02 — Feature — password reset.** Request + reset flow with one-time, expiring tokens; no account enumeration.

## Notifications (NTF)

- **NTF-01 — Feature — notifications page** with pagination.
- **NTF-02 — Feature — per-type preferences** (in-app and push).
- **NTF-03 — Feature — vote and publish-request notifications.**
- **NTF-04 — Feature — TTL on read notifications**, configurable via env (days, or disabled).
- **NTF-05 — Low — manifest icons.** Generate 192/512 PNG icons from the wordmark until the real logo arrives (DOC-07).

## Content (CNT)

- **CNT-01 — Feature — scheduled publishing** (`publishAt`, enforced at read time; no scheduler).
- **CNT-02 — Feature — post revision history.**
- **CNT-03 — Feature — autosaved drafts** in the editor.
- **CNT-04 — Feature — related posts by tag.**

## Visitor interests (VIS)

- **VIS-01 — Feature — anonymous visitor identity.** First-party random visitor cookie (replaces the planned fingerprint.js id); remove unused `TempUser` / `UserInterest` models.
- **VIS-02 — Feature — interest events** (`VisitorEvent`, TTL) recorded on post views.
- **VIS-03 — Feature — identity stitching** on login/registration.
- **VIS-04 — Feature — cookie consent banner**; no tracking cookie or events without consent.
