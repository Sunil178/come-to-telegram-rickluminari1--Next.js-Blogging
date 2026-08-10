---
name: api-route-security
description: Use when adding, modifying, or reviewing a Next.js Route Handler (route.ts/route.js under src/app/api) in this project — anything involving authentication, authorization, rate limiting, or other cross-cutting request-level policy for API routes.
---

# Centralizing API route security in this project

This project centralizes API route authorization in `src/libs/api-guard.ts` via a `withApiGuard()` wrapper. Never add an inline session/auth check directly inside a route handler body — wrap the handler instead.

## The pattern

```ts
import { withApiGuard } from "@/libs/api-guard";

export const POST = withApiGuard(async (request, { session }) => {
  // session is guaranteed non-null here — auth defaults to true
  ...
});
```

For routes with dynamic segments, pass the params type as the generic:

```ts
interface RouteParams {
  params: Promise<{ slug: string }>;
}

export const DELETE = withApiGuard<RouteParams>(async (request, { params, session }) => {
  const { slug } = await params;
  ...
});
```

For an intentionally public route, pass `{ auth: false }` explicitly — `auth` defaults to `true`, so a public mutation-capable route must say so, never rely on omission meaning "public":

```ts
export const GET = withApiGuard(async (request) => { ... }, { auth: false });
```

## Why this exists — don't revert to inline checks or proxy-only protection

- Next.js's own docs (`nextjs.org/docs/app/guides/backend-for-frontend`, "Access to protected resources") say explicitly: **"Always verify credentials before granting access. Do not rely on proxy alone for authentication and authorization."** `src/proxy.ts` handles page-level redirects only (see below) — it is not sufficient on its own for API routes.
- The `proxy.js` API reference also warns that Server Actions are handled as POST requests to whatever route they're used on, so a proxy matcher change can silently stop protecting a route with no error raised. Enforcing at the handler layer avoids that failure mode.
- Historical precedent: CVE-2025-29927 let attackers bypass Next.js middleware entirely via a spoofed header. Apps that relied on middleware as their only auth gate had every "protected" route fully exposed until patched. This is not theoretical caution — middleware-only protection has failed in production before, industry-wide.

## Adding a new cross-cutting concern later (rate limiting, roles, etc.)

Do **not** nest wrapper calls (`withApiAuth(withRateLimit(handler))` was explicitly tried and rejected here as unreadable). Instead extend `ApiGuardOptions` in `src/libs/api-guard.ts` with a new key and enforce it inside the single `withApiGuard` implementation:

```ts
interface ApiGuardOptions {
  auth?: boolean;      // existing, defaults to true
  rateLimit?: { max: number; windowMs: number }; // example of a future addition
}
```

Call sites add the new option only where needed (`{ rateLimit: { max: 20, windowMs: 60_000 } }`); routes that don't need it are unaffected and unchanged. Route handler files should never contain the enforcement logic itself, only the declared options passed to `withApiGuard`.

If a rate limiter is needed: prefer `rate-limiter-flexible` (MIT, supports in-memory/Redis/Postgres/MySQL, no vendor lock-in) over `@upstash/ratelimit` (its client is open source, but it's architected around Upstash's *hosted* Redis over HTTP — a poor fit here given this project deliberately keeps uploads on the local filesystem instead of cloud storage, i.e. it's optimized for self-hosting, not a serverless/edge deployment).

## `proxy.ts`'s role — complementary, not a substitute

`src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`; the two file conventions cannot coexist in one project) still handles **page-level** redirects for logged-out users hitting protected pages (e.g. `/posts/add`, `/dashboard/:path*`) via its `matcher` config. That's good UX (redirect before rendering anything) but it is *not* the security boundary. Keep both layers doing their job:

- `proxy.ts` matcher → optimistic page-level redirect
- `withApiGuard` → actual enforcement at every mutation-capable API route
