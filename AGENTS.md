# Vedev.Guru Blog — agent instructions

Canonical, tool-neutral instructions for AI coding agents (Codex reads this file; Claude Code imports it from `CLAUDE.md`).

## Project

A multi-author blogging platform: Next.js 16 App Router (Turbopack, `src/proxy.ts`), React 19, TypeScript, Tailwind 4 + shadcn/Radix, Plate.js editor, MongoDB via Mongoose, Auth.js v5 (credentials, JWT sessions), Web Push notifications, Vitest. Roles: reader → author → moderator → admin (`src/libs/roles.ts`).

| Path | Contents |
|---|---|
| `src/app/` | Pages, layouts, Route Handlers (`api/**/route.ts`), metadata routes (sitemap, robots, manifest, RSS) |
| `src/libs/` | Server and shared logic: `api-guard.ts`, `notify.ts`, `csp.ts`, `route-gates.ts`, `client-ip.ts`, `auth-rate-limit.ts`, … |
| `src/models/` | Mongoose models |
| `src/components/` | UI (`ui/` is shadcn/Plate generated) |
| `src/proxy.ts` | Per-request CSP nonce on every page; auth and role gates on gated paths |
| `src/instrumentation*.ts` | DB connection at server boot |
| `src/seeds/`, `src/scripts/` | Seeder and admin bootstrap (standalone, outside Next.js) |
| `public/sw.js` | Web Push service worker |
| `docs/` | Roadmap, reviews, procedures, initiatives |

## Commands

| Command | Purpose |
|---|---|
| `npm run dev -- --port=5000` | Dev server (port 5000, never 3000) |
| `npm test` | Vitest suite |
| `npx tsc --noEmit` | Typecheck |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Production build / server |
| `npm run seed` | Seed demo data (password `Passw0rd!`) |
| `npm run bootstrap-admin` | Promote or create the first admin |

## Active initiative

Production readiness: `docs/production-readiness/` (findings, plan, checklist). Resume from `checklist.md`; follow `plan.md`, including decision D-01 (the agent commits each milestone after tests, a high-effort code review and real-browser verification; never push).

## Git

- Outside D-01, never stage or unstage changes (`git add`, `git restore --staged`, `git reset`, `git stash`, `git mv`, …) unless explicitly asked for that action at that moment: the owner stages manually and relies on telling their own staged changes apart. Don't "fix" an accidental staging either; report it. `git mv` and `git stash` both change the index.
- `git commit` without a pathspec commits the whole index; check `git status` first.
- Commit messages: plain descriptive title (no `feat:`/`fix:` prefixes), blank line, a few unwrapped `- ` bullets; no AI attribution trailers. Never push.

## Dev and test servers

- The owner runs their own dev server on port 5000. Before starting any server, check the port; kill every server you started before ending your turn and verify the port is free (`ss -ltnp | grep :5000`).
- Verification servers and end-to-end tests use port 5100 and the `blog_e2e` database, never the owner's database.

## API routes

Route Handlers must not contain inline auth logic: wrap them with `withApiGuard` from `src/libs/api-guard.ts` (auth by default, `role`, `rateLimit`, `objectIdParams`). Procedure: `docs/procedures/api-route-security.md`.

## Database connection

Do not call `dbConnect()` (`src/libs/db-connect.ts`) from routes, pages, or components. `src/instrumentation-node.ts` calls it once when the Next.js server boots, and Mongoose's default connection is shared process-wide after that. The only other callers are `src/seeds/seeder.ts` and `src/scripts/bootstrap-admin.ts`, standalone scripts outside the Next.js server. Never use the raw `mongodb` driver; Mongoose is the only client, including in one-off scripts.

`next build` does not run instrumentation (`registerInstrumentation()` returns early when `NEXT_PHASE === "phase-production-build"`), so there is no DB connection while routes are prerendered. A route that reads the DB must render at request time: it uses a request-time API (`params`, `searchParams`, `cookies()`, `headers()`, `getSession()`) or calls `await connection()` from `next/server` before its first query, as `src/app/sitemap.ts` does. Never use `export const revalidate` or `dynamic = "force-static"` on a DB-backed route, and don't call `dbConnect()` to fix this; otherwise the build fails with a Mongoose "buffering timed out" error.

## Route protection and CSP

Whole-page auth gates live in `src/proxy.ts`, matched by `isGatedPath()` in `src/libs/route-gates.ts` (`/posts/add`, `/posts/:slug/edit`, `/dashboard/**`). Unauthenticated requests are redirected to `/auth/login?callbackUrl=...` before any page renders, and per-prefix role minimums redirect to `/dashboard/posts`. Gated pages don't re-check the session: they cast `getSession() as AuthenticatedSession` (from `src/libs/api-guard.ts`). A new fully-gated page means adding its path to `isGatedPath()`, not a per-page redirect.

`proxy.ts` runs on every page (its matcher skips only API routes and static assets) to set a per-request nonce CSP (`buildContentSecurityPolicy()` in `src/libs/csp.ts`); only gated paths go through the Auth.js `auth()` wrapper. The root layout passes the nonce to next-themes; any new inline `<script>` must take it from `headers().get("x-nonce")` or the CSP blocks it. Nonces require per-request rendering, so every page renders dynamically, which is the deliberate cost of the nonce CSP.

Client components where only an action is gated (voting, commenting, deleting) discover logged-out state from a 401 on their own fetch and build the redirect with `loginRedirectUrl()` from `src/libs/auth-redirect.ts`.

## Conventions

- Fix root causes and every instance of a pattern; write the failing test first for behavioural fixes.
- Comments: short, about the non-obvious why.
- Documentation changes in the same commit as the behaviour; reference docs describe the current system in the present tense.
- No hard wrapping in prose (docs, commit messages): one paragraph or list item per line.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
