# Vedev.Guru Blog

A multi-author blogging platform built with Next.js 16 (App Router), React 19, MongoDB and Auth.js. Authors write with a rich-text editor (Plate.js); moderators approve posts; readers comment, vote and get in-app and Web Push notifications.

## Features

- Rich-text posts with banner images, tags, categories, table of contents and reading time
- Roles: reader → author → moderator → admin, with publish requests and post approval
- Threaded comments, votes on posts, comments and profiles
- In-app notifications with Web Push (service worker), live bell updates
- Deduplicated, rate-limited page-view counting
- SEO: sitemap, robots.txt, RSS feed (`/feed.xml`), Open Graph metadata
- Security: nonce-based Content-Security-Policy, rate-limited login, registration and APIs, sanitized post HTML, SSRF-safe push endpoints

## Tech stack

Next.js 16 (Turbopack, `proxy.ts`), React 19, TypeScript, Tailwind CSS 4, shadcn/ui + Radix, Plate.js, MongoDB + Mongoose 9, Auth.js v5 (credentials, JWT), web-push, rate-limiter-flexible, Vitest.

## Getting started

Requirements: Node.js 20.9+ (the minimum for Next.js 16), npm, and a MongoDB server (local or a connection string).

```bash
npm install
cp .env.example .env        # then fill in the values (see below)
npm run seed                # optional: demo users, categories, posts and comments
npm run dev -- --port=5000  # http://localhost:5000
```

Seeded demo users all use the password `Passw0rd!` (see `src/seeds/users.json` for emails and roles).

To make an existing account the first admin (or create one), run `npm run bootstrap-admin`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `AUTH_SECRET` | yes | Auth.js signing secret (`openssl rand -base64 32`) |
| `AUTH_URL` | production | Canonical site URL; without it (or `AUTH_TRUST_HOST=true`), Auth.js rejects sessions under `next start` outside Vercel/Cloudflare |
| `NEXT_PUBLIC_SITE_URL` | production | Public origin for metadata, sitemap, RSS and OG links; an `https://` origin also enables `upgrade-insecure-requests` in the CSP |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL` | for push | Web Push keys (`npx web-push generate-vapid-keys`); without them notifications are in-app only |
| `TRUSTED_PROXY_HOPS` | behind a proxy | Number of trusted proxies appending to `X-Forwarded-For` (default 1) |
| `CLIENT_IP_HEADER` | behind a CDN | Header carrying the client IP instead, e.g. `cf-connecting-ip` |
| `VIEW_RATE_LIMIT_POINTS`, `VIEW_RATE_LIMIT_DURATION_SECONDS` | no | Page-view endpoint rate limit (defaults 20 per 60 s) |
| `LOG_LEVEL`, `LOG_FORMAT` | no | Log level (`debug`/`info`/`warn`/`error`); `LOG_FORMAT=json` forces JSON lines outside production |

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server (use `-- --port=5000`) |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit and route tests (Vitest) |
| `npm run test:e2e` | Production build, then the Playwright end-to-end suite (see below) |
| `npm run lint` | ESLint |
| `npm run seed` | Seed demo data into `MONGODB_URI` |
| `npm run bootstrap-admin` | Create or promote the first admin |

## Testing

- `npm test` runs the Vitest unit and route tests (models are mocked; no database needed).
- `npm run test:e2e` builds the app and runs the Playwright suite in `e2e/` against `next start` on port 5100 (`E2E_PORT`), using an isolated database (`E2E_MONGODB_URI`, default `mongodb://127.0.0.1:27017/blog_e2e`) that is dropped and re-seeded on every run. The setup refuses database names that don't end in `_e2e`. First run: `npx playwright install chromium`.

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

## Deploying to production

- **Run behind a reverse proxy** (Caddy, nginx, or a platform/CDN proxy) that terminates HTTPS and sets the client IP; set `TRUSTED_PROXY_HOPS` or `CLIENT_IP_HEADER` to match. Directly exposed, client IPs can be spoofed and per-IP rate limits bypassed.
- **Set** `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL` (it is inlined at build time, so set it before `npm run build`) and the VAPID keys.
- **Single instance:** rate limits are kept in memory per process, and uploads are stored on the local disk (`uploads/`). Use one instance with a persistent disk until shared storage and a shared limiter are added (see `docs/roadmap.md`).

## Contributing

Agent and contributor rules live in [AGENTS.md](AGENTS.md). Active work is tracked in [docs/production-readiness/](docs/production-readiness/).
