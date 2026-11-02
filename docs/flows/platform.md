# Platform

**Who:** everyone; operators for the health check. **Entry points:** every page.

## How it works

`src/proxy.ts` runs on every page: it sets a per-request nonce Content-Security-Policy (`src/libs/csp.ts`) and, for gated paths (`src/libs/route-gates.ts`), checks the session and role before the page renders. Nonces need per-request rendering, so every page renders dynamically. Segments stream behind their own `loading.tsx` skeletons; the home page and the posts list keep theirs in route groups (`src/app/(home)/`, `src/app/posts/(list)/`) so they don't wrap other pages. A response's status is fixed once the skeleton streams, so the post and author pages check that their post or account exists in a `layout.tsx` outside their skeleton (`src/app/posts/[slug]/(read)/`, `src/app/users/[username]/`; lookups in `src/libs/post-page.ts` and `src/libs/profile-page.ts`, cached per request; link prefetches skip the check), and a missing one answers 404. Gated pages (editor, revisions, dashboard) stay out of search and keep a 200 with the not-found page. The theme (light, dark, system) comes from next-themes with the nonce. The dashboard menu (`src/components/dashboard/DashboardNav.tsx`, built in `src/app/dashboard/layout.tsx`) groups its pages by role and frequency of use (each group on its own row on a phone, divided by a thin line on wider screens): the user's own pages (My Posts, Notifications, Account), then for moderators Review Queue and Comments, then for admins Publish Requests, All Posts, Users, Categories and Uploads. It highlights the current page and wraps on narrow screens. The avatar menu offers Write a post (authors and above), the same personal pages (`src/libs/dashboard-links.ts`) and Logout. `/api/health` reports the app and database state for uptime checks and the container health check.

## Flows

### 1. Gated pages

1. A logged-out visitor opens `/dashboard/...`, `/posts/add`, or a post's edit or revisions page. → Sent to sign in with `callbackUrl`, and back after signing in.
2. A signed-in user without the role opens a role-gated page. → Redirected to My Posts.

**Tested by:** `e2e/auth.spec.ts` › "gated pages redirect a logged-out visitor to login and back"; `e2e/admin.spec.ts` › "non-admins can't reach admin pages or admin APIs".

### 2. Content Security Policy

1. Any page loads. → Its response carries a nonce CSP and the page renders with no CSP violations in the console.

**Tested by:** `e2e/auth.spec.ts` › "pages carry a nonce CSP and render without CSP violations".

### 3. Loading and not-found states

1. Opens the editor or a dashboard page on a slow connection. → A skeleton shaped like that page, not the posts grid.
2. Opens an unknown address, post or author. → The not-found page, titled "Page not found", with status 404.

**Tested by:** `e2e/content.spec.ts` › "the editor and dashboard pages stream their own loading skeletons, not the posts grid"; `e2e/reading.spec.ts` › "unknown, deleted and non-public posts show readers the not-found page with a 404 status".

### 4. Theme and phone layout

1. Switches the theme. → It applies at once and persists across pages and reloads.
2. On a phone, opens the menu. → It opens, navigates and closes.

**Tested by:** `e2e/reading.spec.ts` › "the theme choice persists across pages and reloads", "on a phone, the menu opens, navigates and closes".

### 5. Install and health

1. The browser reads the web app manifest. → Installable, with PNG icons.
2. A monitor calls `/api/health`. → 200 with `{"status":"ok","db":"up"}`, or 503 with `{"status":"error","db":"down"}` when MongoDB is unreachable.

**Tested by:** `e2e/notifications.spec.ts` › "the web app manifest offers installable PNG icons"; `e2e/reading.spec.ts` › "the health check reports the app and database as up".

## Rules and limits

- Any new inline `<script>` must use the nonce from `headers().get("x-nonce")`, or the CSP blocks it.
- `/api/health`: 60 requests a minute per address.
- Rate limits are kept in memory per process: one app instance until a shared store is added (see `docs/roadmap.md`).
