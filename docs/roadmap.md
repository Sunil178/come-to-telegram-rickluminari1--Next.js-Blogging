# Vedev.Guru Blog — Feature Roadmap

## Context

The revamp in `docs/revamp-plan.md` covers the UI stack, editor, and core comment/voting/auth systems, all of which are in place. This doc scopes the next layer of work: closing gaps between "a working blog" and "a blog that's fully operable and discoverable in production."

All items previously scoped here (SEO/production plumbing, real page-view tracking, in-app notifications) have shipped. In-app notifications are backed by a `Notification` model plus real Web Push (`src/libs/notify.ts`, `src/models/PushSubscription.ts`, `public/sw.js`) rather than polling — a push event updates the navbar bell live in an open tab and can deliver an OS-level notification when none is open; the bell also fetches once on mount as a correctness fallback for browsers or permission states where push isn't available.

## Deferred infrastructure

Known limits that are fine for a single-instance deployment and are scheduled for later.

### Upload storage

Uploads (`src/app/api/posts/upload/route.ts`) are written to the local `uploads/` directory. That needs a persistent disk and a single instance; files are lost on serverless platforms and aren't shared between instances. Next step: an object-storage backend (S3 or Cloudflare R2) behind the same upload route, or a mounted persistent volume when running in containers.

### Shared rate limiter

`withApiGuard`'s `rateLimit` option and the login/registration limits (`src/libs/auth-rate-limit.ts`) use in-memory `rate-limiter-flexible` limiters: counts reset on restart and aren't shared across instances, so N instances allow N times the configured rate. Next step: switch to `RateLimiterRedis` (same library and API) when running more than one instance.

### PWA icons

Chrome's install prompt needs 192×192 and 512×512 PNG icons in the web manifest. Icons generated from the wordmark (`src/scripts/generate-icons.mjs`, output in `public/icons/`) stand in until the real logo is supplied; replace `public/icons/icon-192.png`, `icon-512.png` (also used as the maskable icon, so keep the mark inside the central 80%) and `apple-touch-icon.png`.

### CI/CD (GitHub Actions)

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: lint, typecheck, unit tests and build, and the Playwright suite (Chromium) against MongoDB and Mailpit service containers. Next steps:

- On `main`: build the Docker image and push it to GitHub Container Registry (`ghcr.io`), tagged with the commit SHA and `latest`.
- Deploy: a manually triggered job that pulls the image on the target host (SSH or the host's webhook), since the deployment target is chosen later. GitHub-hosted runners' free tier covers this; no paid runners are needed.

## Later work

### Recommendations from reading history

Consenting visitors' reads are already recorded (`VisitorEvent`, 180-day TTL, stitched to the account at sign-in; `src/libs/visitor-events.ts`), but nothing reads them yet. Next: a "Recommended for you" list from the tags of recently read posts, weighted by recency and excluding posts already read, falling back to related posts when there's no history.

### Search at scale

Search uses a weighted MongoDB text index (title, tags, description, summary; stemmed, ranked by relevance) with a title fallback for half-typed words, and related posts score only the newest 200 tag matches and newest 200 same-category posts (`src/libs/post-search.ts`, `src/libs/related-posts.ts`). The text index has no typo tolerance or prefix matching, matches whole words only ("script" doesn't find "JavaScript") and doesn't cover post bodies. Next, once there are tens of thousands of posts or readers ask for it: Atlas Search or Meilisearch, indexing the body text too.

### Error tracking

Server errors are logged as JSON lines; an error tracker (Sentry or self-hosted GlitchTip) hooked into `onRequestError` and the client error boundary would group them and alert. See `docs/deployment-checklist.md`.

### Not-found status on streamed pages

The root `loading.tsx` makes every page stream, so a missing post renders the not-found page with status 200 (Next.js adds `noindex` instead). Route-level loading boundaries that leave the post page unstreamed would return a real 404.
