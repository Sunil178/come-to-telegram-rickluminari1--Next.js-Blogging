# Vedev.Guru Blog — Feature Roadmap

## Context

This doc lists the known limits of the current system and the work planned beyond it. What the system does today is described in `README.md` and the flow documents in `docs/flows/`.

## Deferred infrastructure

Known limits that are fine for a single-instance deployment and are scheduled for later.

### Upload storage

Uploads (`src/app/api/posts/upload/route.ts`) are written to the local upload directory (`UPLOAD_DIR`). That needs a persistent disk and a single instance; files are lost on serverless platforms and aren't shared between instances. Next step: an object-storage backend (S3 or Cloudflare R2) behind the same upload route, or a mounted persistent volume when running in containers.

### Shared rate limiter

`withApiGuard`'s `rateLimit` option and the login/registration limits (`src/libs/auth-rate-limit.ts`) use in-memory `rate-limiter-flexible` limiters: counts reset on restart and aren't shared across instances, so N instances allow N times the configured rate. Next step: switch to `RateLimiterRedis` (same library and API) when running more than one instance.

### PWA icons

Chrome's install prompt needs 192×192 and 512×512 PNG icons in the web manifest. Icons generated from the wordmark (`src/scripts/generate-icons.mjs`, output in `public/icons/`) stand in until the real logo is supplied; replace `public/icons/icon-192.png`, `icon-512.png` (also used as the maskable icon, so keep the mark inside the central 80%) and `apple-touch-icon.png`.

### CI/CD (GitHub Actions)

`.github/workflows/ci.yml` is set to run on every push to `main` and every pull request (it has not run on GitHub yet): lint, typecheck, unit tests and build, and the Playwright suite (Chromium) against MongoDB and Mailpit service containers. Next steps:

- On `main`: build the Docker image and push it to GitHub Container Registry (`ghcr.io`), tagged with the commit SHA and `latest`.
- Deploy: a manually triggered job that pulls the image on the target host (SSH or the host's webhook), since the deployment target is chosen later. GitHub-hosted runners' free tier covers this; no paid runners are needed.

## Later work

### Recommendations from reading history

Consenting visitors' reads are already recorded (`VisitorEvent`, 180-day TTL, stitched to the account at sign-in; `src/libs/visitor-events.ts`), but nothing reads them yet. Next: a "Recommended for you" list from the tags of recently read posts, weighted by recency and excluding posts already read, falling back to related posts when there's no history.

### Search at scale

Search uses a weighted MongoDB text index (title, tags, description, summary; stemmed, ranked by relevance) with a title fallback for half-typed words, and related posts score only the newest 200 tag matches and newest 200 same-category posts (`src/libs/post-search.ts`, `src/libs/related-posts.ts`). The text index has no typo tolerance or prefix matching, matches whole words only ("script" doesn't find "JavaScript") and doesn't cover post bodies. Next, once there are tens of thousands of posts or readers ask for it: Atlas Search or Meilisearch, indexing the body text too.

### Error tracking

Server errors are logged as JSON lines; an error tracker (Sentry or self-hosted GlitchTip) hooked into `onRequestError` and the client error boundary would group them and alert. See `docs/deployment-checklist.md`.
