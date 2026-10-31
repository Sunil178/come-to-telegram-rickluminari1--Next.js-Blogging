---
name: nextjs-proxy-not-middleware
description: Next.js renamed middleware.ts to proxy.ts — check for src/proxy.ts before concluding a repo has no route-protection middleware.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1e1cae2a-8e4b-42f8-91ca-a74066b02baa
  modified: 2026-08-14T12:29:44.978Z
---

Next.js renamed the `middleware.ts` file convention to `proxy.ts` (both names are still recognized at runtime, but new projects/docs use `proxy.ts`). Before concluding a repo has "no middleware" or "no route protection," grep for `proxy.ts` too, not just `middleware.ts`.

**Why:** In this repo (Next.js 16.1.6), I searched only for `middleware.ts`, found nothing, and concluded `/posts/add` had no auth gate — a real regression from what the revamp plan's Phase 0 called for. I then added a redundant page-level session check. It turned out `src/proxy.ts` already existed, already had the correct `config.matcher` (`/posts/add`, `/posts/:slug/edit`, `/dashboard/:path*`), and was already redirecting unauthenticated requests at the edge — confirmed by reverting my page-level fix and re-testing with cleared cookies; the redirect still fired. My knowledge cutoff predates this Next.js rename, which is what caused the miss.

**How to apply:** In any Next.js App Router repo, when checking for route-level auth/redirect logic, search for both `middleware.ts` and `proxy.ts` (root and `src/`) before concluding none exists. This repo's own `CLAUDE.md` ("Route protection" section) documents its `src/proxy.ts` matcher and the `AuthenticatedSession` cast convention for pages it covers — read from there rather than re-deriving.
