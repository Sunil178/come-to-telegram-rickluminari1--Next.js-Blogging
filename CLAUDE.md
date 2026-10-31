# Repository instructions for Claude Code

## Active initiative

Production readiness: `docs/production-readiness/` (findings, plan, checklist). Resume from `checklist.md`; follow `plan.md`, including decision D-01 (the agent commits each milestone after tests, `/code-review high` and Playwright verification; never push).

## Git

Never stage or unstage changes (`git add`, `git restore --staged`, `git reset`, `git stash`, `git mv`, etc.) unless explicitly asked for that specific action in that moment — the user stages everything manually themselves and relies on being able to distinguish their own staged changes from new ones. This applies even when you believe a tool (e.g. the shadcn CLI) auto-staged something, or when undoing your own earlier mistake — do not run `git restore --staged` to "fix" that either; tell the user what happened and let them decide. See the `repo-workflow-safety` skill for known gotchas (e.g. `git mv` and `git stash` both have staging side effects). Use `/commit` once the user has staged what they want committed — it drafts a single conclusive commit message instead of a trail of fix-up commits.

## Dev server

Runs on port 5000 in this project (`npm run dev -- --port=5000`), not the Next.js default 3000 — another project on this machine already uses 3000. Check whether a server is already running before starting a new one or deleting `.next`. **Whenever you start it yourself, you must kill it before ending your turn** — the user runs their own dev server on 5000 and needs the port free to see live logs in their own terminal. Verify with `ss -ltnp | grep :5000` (or equivalent) before finishing, not just by assuming a background process ended. See the `repo-workflow-safety` skill.

## API routes

Route Handlers (`src/app/api/**/route.ts`) must not contain inline auth logic — wrap them with `withApiGuard` from `src/libs/api-guard.ts`. See the `api-route-security` skill for the pattern and the reasoning behind it.

## Database connection

Do not call `dbConnect()` (`src/libs/db-connect.ts`) from routes, pages, or components. `src/instrumentation.ts` / `src/instrumentation-node.ts` already calls it once when the Next.js server boots — mongoose's default connection is shared process-wide after that, so every model call downstream (`Post.find(...)`, etc.) just works with no per-file connect step. The only other legitimate callers are `src/seeds/seeder.ts` and `src/scripts/bootstrap-admin.ts`, standalone scripts that run outside the Next.js server, so instrumentation never fires for them. Never use the raw `mongodb` driver in this codebase — `mongoose` is the only supported client, including in one-off scripts.

`next build` does not run instrumentation (`registerInstrumentation()` returns early when `NEXT_PHASE === "phase-production-build"`), so there is no DB connection while routes are prerendered. A route that reads the DB must render at request time: it uses a request-time API (`params`, `searchParams`, `cookies()`, `headers()`, or `getSession()`), or calls `await connection()` from `next/server` before its first query, as `src/app/sitemap.ts` does. Never use `export const revalidate` or `dynamic = "force-static"` on a DB-backed route, and don't call `dbConnect()` to fix this. Otherwise the build fails with a Mongoose "buffering timed out" error.

## Route protection

Whole-page auth gates live in `src/proxy.ts` (Next.js's `middleware.ts` convention, under its current file name), matched by `isGatedPath()` in `src/libs/route-gates.ts` (currently `/posts/add`, `/posts/:slug/edit`, `/dashboard` and everything under it). It redirects unauthenticated requests to `/auth/login?callbackUrl=...` at the edge, before any page component renders. Pages matched by it (e.g. `src/app/posts/[slug]/edit/page.tsx`, `src/app/dashboard/posts/page.tsx`) don't re-check `session?.user` and redirect again — they cast with `getSession() as AuthenticatedSession` (exported from `src/libs/api-guard.ts`) and trust it. Adding a new fully-gated page (not just an action inside an otherwise-public page) means adding its path to `isGatedPath()`, not writing a per-page auth redirect. `proxy.ts` itself runs on every page (its `config.matcher` excludes only API routes and static assets) because it also sets the per-request CSP nonce (`buildContentSecurityPolicy()` in `src/libs/csp.ts`), but it wraps only gated paths in the Auth.js `auth()` handler; the root layout passes that nonce to next-themes. A new inline `<script>` must take the nonce from `headers().get("x-nonce")`, or the CSP blocks it. Nonces require per-request rendering, so every page renders dynamically; that is the deliberate cost of the nonce-based CSP.

Client components where only an *action* is gated (voting, commenting, deleting) rather than the whole page discover logged-out state from a 401 on their own fetch call, since those pages stay publicly viewable and `proxy.ts` doesn't apply to them. Build the redirect target with `loginRedirectUrl()` from `src/libs/auth-redirect.ts` rather than hand-rolling `` `/auth/login?callbackUrl=${encodeURIComponent(...)}` `` inline.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
