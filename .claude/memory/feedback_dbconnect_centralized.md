---
name: feedback-dbconnect-centralized
description: "Never call dbConnect() from routes/pages/components in this repo — instrumentation.ts already connects once at server boot. Only src/instrumentation-node.ts and src/seeds/seeder.ts may call it."
metadata:
  type: feedback
  originSessionId: 1e1cae2a-8e4b-42f8-91ca-a74066b02baa
  modified: 2026-08-15T19:00:05.914Z
---

This repo uses Next.js's `src/instrumentation.ts` / `src/instrumentation-node.ts` hook to open the MongoDB connection exactly once when the server process boots (verified: it registers `Category`/`Post` models and calls `dbConnect()`, and the log line "New MongoDB connection established" appears once at startup, not per-request). `src/libs/db-connect.ts` caches the connection on `global.mongoose`, so calling it again anywhere is harmless but redundant boilerplate — and the user flagged writing `await dbConnect()` in every API route/page/component as a review-worthy mistake, not a stylistic nit.

**Why:** I had scattered `await dbConnect()` + the import across 14 files (routes, server components, a server action) despite the instrumentation hook already guaranteeing the connection exists before any request is served. The clearest proof this was always unnecessary: `src/app/api/posts/route.ts` (POST create-post) never called `dbConnect()` at all and worked fine the whole time. The user asked "why are you writing it again and again?" and wanted it centralized.

**How to apply:** Do not add `import dbConnect from "@/libs/db-connect"` or `await dbConnect()` to any new route handler, page, server component, or server action in this repo — the connection is already live by the time request-handling code runs. The legitimate call sites are `src/instrumentation-node.ts` (the one true call, at server boot) and standalone scripts run via `node`/`tsx` outside the Next.js server process (`src/seeds/seeder.ts`, `src/scripts/bootstrap-admin.ts`) — instrumentation never fires for those, so they call `dbConnect()` themselves and use the real Mongoose models (never the raw `mongodb` driver — that snuck into `bootstrap-admin.ts` once and was corrected on review). This is now also documented in this repo's CLAUDE.md under "Database connection" — check there first since the instruction is durable/checked-in, not just memory.

**Build-time exception (2026-10-31):** instrumentation does *not* run during `next build` (Next skips `register()` in `phase-production-build`), so a DB-reading route that gets prerendered (e.g. `sitemap.ts` with `revalidate`) times out. The fix is to make that route request-time with `await connection()` — not to call `dbConnect()` in it. Documented in CLAUDE.md under "Database connection".
