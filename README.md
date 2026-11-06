# Vedev.Guru Blog

A multi-author blogging platform built with Next.js 16 (App Router), React 19, MongoDB and Auth.js. Authors write with a rich-text editor (Plate.js); moderators approve posts; readers comment, vote and get in-app and Web Push notifications.

## Features

- Rich-text posts with banner images, tags, categories, table of contents, reading time and related posts; search ranked by relevance over titles, tags, descriptions and summaries
- Scheduled publishing (an approved post stays hidden until its publish time), revision history with restore, and editor drafts autosaved in the browser
- Roles: reader → author → moderator → admin, with publish requests (an application reviewed alongside the applicant's profile and approximate sign-up, sign-in and request locations) and post approval
- Profiles: photo, public author profile and private details visible only to the user and admins; change password from the account page
- Image uploads stripped of their metadata (GPS included) before they're served, with the original camera, time and place kept privately; per-file, daily, storage and rate limits from the environment; an admin uploads report to download and delete unused files
- Accounts with email verification and password reset over SMTP (one-time, expiring links; a reset signs out other sessions), passwords of at least 8 characters
- Privacy: a privacy policy page (`/privacy`), a JSON download of everything stored about the account, and self-service account deletion (`/dashboard/account`)
- Threaded comments, votes on posts, comments and profiles
- Notifications for replies, comments, upvotes, moderation decisions and publish requests: a live bell, a paginated notifications page, per-category in-app and push switches, Web Push via a service worker, and read notifications expiring after a configurable time
- Deduplicated, rate-limited page-view counting
- Consent-based reading history: with the visitor's consent, a first-party cookie records which posts they read (kept 180 days) and attaches that history to their account when they sign in or register; declining or withdrawing consent (footer "Cookie preferences") deletes it
- SEO: sitemap, robots.txt, RSS feed (`/feed.xml`), Open Graph metadata
- Security: nonce-based Content-Security-Policy, rate-limited login, registration and APIs, sanitized post HTML, SSRF-safe push endpoints

## Tech stack

Next.js 16 (Turbopack, `proxy.ts`), React 19, TypeScript, Tailwind CSS 4, shadcn/ui + Radix, Plate.js, MongoDB + Mongoose 9, Auth.js v5 (credentials, JWT), web-push, rate-limiter-flexible, Vitest.

## Getting started

Requirements: Node.js 20.9+ (the minimum for Next.js 16), npm, and a MongoDB server (local or a connection string).

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npm run seed                # optional: demo users with full profiles, categories, posts and comments
npm run dev -- --port=5000  # http://localhost:5000
```

Seeded demo users all use the password `Passw0rd!` (see `src/seeds/users.json` for emails, roles and profiles). Running the seeder again fills profile fields a demo user left empty without overwriting their own edits, and records an upload (owned by the posts' owner) for every demo banner.

To make an existing account the first admin (or create one), run `npm run bootstrap-admin`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `AUTH_SECRET` | yes | Auth.js signing secret (`openssl rand -base64 32`) |
| `AUTH_URL` | production | Canonical site URL; without it (or `AUTH_TRUST_HOST=true`), Auth.js rejects sessions under `next start` outside Vercel/Cloudflare |
| `SITE_URL` | production | Public origin for metadata, sitemap, RSS and OG links; an `https://` origin also enables `upgrade-insecure-requests` in the CSP. Read at runtime |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL` | for push | Web Push keys (`npx web-push generate-vapid-keys`), read at runtime; without them notifications are in-app only |
| `TRUSTED_PROXY_HOPS` | behind a proxy | Number of trusted proxies appending to `X-Forwarded-For` (default 1) |
| `CLIENT_IP_HEADER` | behind a CDN | Header carrying the client IP instead, e.g. `cf-connecting-ip` |
| `VIEW_RATE_LIMIT_POINTS`, `VIEW_RATE_LIMIT_DURATION_SECONDS` | no | Page-view endpoint rate limit (defaults 20 per 60 s) |
| `UPLOAD_DIR` | no | Directory uploaded images are stored in and served from at `/uploads/...` (default `uploads/`; `/app/uploads` in Docker) |
| `UPLOAD_MAX_FILE_MB` | no | Largest image a user can upload, in MB (default 5) |
| `UPLOAD_DAILY_LIMIT` | no | Images one user can upload in 24 hours (default 50; 0 = no limit) |
| `UPLOAD_STORAGE_LIMIT_MB` | no | Total size of one user's uploads, in MB (default 500; 0 = no limit) |
| `UPLOAD_RATE_LIMIT_PER_HOUR` | no | Upload requests per hour from one address, for each upload endpoint (default 30) |
| `GEOIP_DB_PATH` | no | DB-IP City Lite database (`npm run geoip:download`, refresh monthly) used to show admins the approximate location of sign-up, sign-in and publish-request addresses; unset, locations are off. Loaded into memory on first use (about 130 MB) and reloaded when the file changes. Compose mounts `./data/geoip` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | for email | SMTP server for account emails. With `SMTP_HOST` set, new accounts confirm their email before logging in and password reset is available; without it, accounts start verified and reset is off |
| `NOTIFICATION_READ_TTL_DAYS` | no | Days read notifications are kept before MongoDB's TTL monitor deletes them (default 90; `0` keeps them forever). Applied at server start; unread notifications never expire |
| `OPERATOR_NAME`, `OPERATOR_LOCATION`, `CONTACT_EMAIL` | for launch | Who runs the site, where, and how to reach them: shown on `/about`, `/contact` (as the grievance officer), `/terms` (which courts) and `/privacy` (the data fiduciary). Unset, the pages use neutral wording |
| `SIGNUP_ENABLED`, `COMMENTS_ENABLED` | no | Feature switches (default on; `false`, `0`, `off` or `no` turns one off). Closed sign-up shows a notice on `/auth/register` and refuses new accounts; comments off hides them on posts and refuses new ones and edits |
| `MONGODB_POOL_SIZE` | no | Size of the MongoDB connection pool (default 10), filled from server start. Fixed-size because a connection opened on demand during a request keeps that request's memory alive (Node 24 async context) |
| `LOG_LEVEL`, `LOG_FORMAT` | no | Log level (`debug`/`info`/`warn`/`error`); `LOG_FORMAT=json` forces JSON lines outside production |

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server (use `-- --port=5000`) |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit and route tests (Vitest) |
| `npm run test:e2e` | Production build, then the Playwright end-to-end suite in Chromium (see below) |
| `npm run test:e2e:browsers` | The same suite in Chromium, Google Chrome, Microsoft Edge, Firefox and a phone viewport |
| `npm run lint` | ESLint |
| `npm run seed` | Seed demo data into `MONGODB_URI` |
| `npm run geoip:download` | Download this month's DB-IP City Lite database to `GEOIP_DB_PATH` (default `data/geoip/dbip-city-lite.mmdb`) |
| `npm run bootstrap-admin` | Create or promote the first admin |

## Testing

- `npm test` runs the Vitest unit and route tests (models are mocked; no database needed).
- `npm run test:e2e` builds the app and runs the Playwright suite in `e2e/` against `next start` on port 5100 (`E2E_PORT`), using an isolated database (`E2E_MONGODB_URI`, default `mongodb://127.0.0.1:27017/blog_e2e`) that is dropped and re-seeded on every run. The setup refuses database names that don't end in `_e2e`. Test browsers start with a stored cookie-consent choice (`presetConsent` in `e2e/fixtures.ts`) so the banner doesn't cover controls; `e2e/consent.spec.ts` tests the banner itself. Account emails go to Mailpit, which must be running: `docker compose --profile mail up -d mailpit` (SMTP on 1025, API on 8025; `E2E_SMTP_PORT`, `E2E_MAILPIT_URL`). First run: `npx playwright install chromium` (and `firefox` for the browsers run).
- `npm run test:e2e:browsers` adds the `chrome` and `msedge` projects (the installed Google Chrome and Microsoft Edge; `E2E_EDGE_PATH` points at Edge, default the Flathub install), Playwright's `firefox` and `mobile` (Pixel 7). Each project runs in its own invocation (`npx playwright test --project=firefox`; the script loops over them) so each starts on a freshly seeded database. `e2e/push.spec.ts` delivers a real Web Push notification through Google's and Microsoft's push services, so it runs only in `chrome` and `msedge` (bundled Chromium has no push service, and Playwright's Firefox build never answers the subscription request) and needs internet access.

## Operations

- **Health check:** `GET /api/health` returns `200 {"status":"ok","db":"up"}` when MongoDB answers a ping, `503` otherwise. Use it for container health checks and uptime monitors.
- **Logs:** server code logs through `src/libs/logger.ts`: one JSON object per line in production (`level`, `time`, `msg`, fields; errors with name, message and stack). Every unhandled server error (render, Route Handler, Server Action, proxy) is logged by `onRequestError` in `src/instrumentation.ts` with its route and digest, never with request headers.

## Project structure

| Path | Contents |
|---|---|
| `src/app/` | Pages, layouts, API Route Handlers, metadata routes |
| `src/libs/` | Server and shared logic (API guard, notifications, CSP, rate limits) |
| `src/models/` | Mongoose models |
| `src/components/` | UI components |
| `src/proxy.ts` | CSP nonce on every page; auth and role gates |
| `public/sw.js` | Web Push service worker |
| `docs/` | Roadmap, reviews, procedures, initiatives |

## Docker

The `Dockerfile` builds a self-contained Next.js server (standalone output, runs as the non-root `node` user, health-checked through `/api/health`). Configuration is read at runtime, so one image works in every environment.

```bash
cp .env.example .env                               # fill in AUTH_SECRET, AUTH_URL, SITE_URL, VAPID keys
docker compose up -d --build                       # app + MongoDB → http://localhost:3000
docker compose --profile proxy up -d --build       # + Caddy with automatic HTTPS for SITE_DOMAIN (ports 80/443)
docker compose --profile mail up -d                # + Mailpit: SMTP on localhost:1025 (SMTP_HOST=mailpit for the app container), inbox at http://localhost:8025
```

- **First admin:** the image ships only the server, so run the scripts from a checkout against the Compose database, which is published on loopback port `MONGO_PORT` (default 27018): `MONGODB_URI=mongodb://127.0.0.1:27018/blog npm run bootstrap-admin` (likewise `npm run seed` for demo data).
- Compose points the app at its own `mongo` service (`COMPOSE_MONGODB_URI` overrides it) and keeps data in named volumes: `mongo-data` for the database and `uploads` for uploaded images (mounted at `UPLOAD_DIR=/app/uploads`).
- With the `proxy` profile, set `SITE_DOMAIN` to your domain (DNS pointing at the server), `AUTH_URL` and `SITE_URL` to `https://<domain>`, and keep `TRUSTED_PROXY_HOPS=1`. The Caddyfile is in `deploy/Caddyfile`.
- **Linux kernel 6.19 or newer:** `mongod` 8 refuses to start there ([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)) unless `GLIBC_TUNABLES=glibc.pthread.rseq=1` is set, which the `mongo` service does. To use another MongoDB instead (a managed cluster), set `COMPOSE_MONGODB_URI` and start the app without the bundled database: `docker compose up -d --build --no-deps app`.
- **Local staging:** `deploy/staging.sh up` builds the image and runs the whole stack (MongoDB, app, Caddy, Mailpit) as the separate Compose project `vedev-staging` on `https://localhost:8443`, with generated secrets in `deploy/staging/app.env` and its own ports and volumes. Caddy's certificate comes from its local CA, which is never installed into the host's trust store, so browsers show a certificate warning. `deploy/staging.sh e2e` re-seeds its `blog_e2e` database and runs the Playwright suite against it (`deploy/staging.sh e2e --project=chrome` for push); `deploy/staging.sh down` removes it.
- **Backups:** `deploy/backup.sh` and `deploy/restore.sh` (database and uploads); see [docs/procedures/backup-restore.md](docs/procedures/backup-restore.md).
- Without Compose: `docker build -t vedev-blog .` and `docker run -p 3000:3000 --env-file .env -v blog-uploads:/app/uploads vedev-blog`, with `MONGODB_URI` pointing at your database.
- To run the end-to-end suite against a running deployment instead of a local build: seed its database (`MONGODB_URI=<…>_e2e npx tsx e2e/seed.ts`), point its `SMTP_HOST`/`SMTP_PORT` at Mailpit and `SITE_URL` at its own URL, then `E2E_BASE_URL=http://host:port npx playwright test --project=chromium`.

## Deploying to production

Step-by-step: [docs/deployment-checklist.md](docs/deployment-checklist.md) (server, DNS, email deliverability, configuration, backups, monitoring).

- **Run behind a reverse proxy** (Caddy, nginx, or a platform/CDN proxy) that terminates HTTPS and sets the client IP; set `TRUSTED_PROXY_HOPS` or `CLIENT_IP_HEADER` to match. Directly exposed, client IPs can be spoofed and per-IP rate limits bypassed.
- **Set** `AUTH_SECRET`, `AUTH_URL`, `SITE_URL` and the VAPID keys. All configuration is read at runtime, so one build (or Docker image) works in every environment.
- **Single instance:** rate limits are kept in memory per process, and uploads are stored on the local disk (`UPLOAD_DIR`). Use one instance with a persistent disk or volume until shared storage and a shared limiter are added (see `docs/roadmap.md`).

## Contributing

Agent and contributor rules live in [AGENTS.md](AGENTS.md). Active work is tracked in [docs/production-readiness/](docs/production-readiness/).
