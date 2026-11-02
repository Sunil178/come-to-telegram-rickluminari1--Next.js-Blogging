# QA testing: Vedev.Guru blog

How this project runs the QA method in [docs/kits/flow-qa/method.md](../kits/flow-qa/method.md). The flow inventory and documents are in [docs/flows/](../flows/README.md); the current QA pass is [docs/qa/checklist.md](../qa/checklist.md). Every bug a session finds ends as a failing test, then a fix, then an updated flow document.

## Isolated environment

- **Server:** a production build on port 5100, never the owner's dev server on 5000 (or 3000). `npx next build`, then either the Playwright web server (`npx playwright test` starts and stops it) or, for a manual session, seed with `MONGODB_URI=mongodb://127.0.0.1:27017/blog_e2e npx tsx e2e/seed.ts` and start `MONGODB_URI=mongodb://127.0.0.1:27017/blog_e2e AUTH_URL=http://localhost:5100 AUTH_SECRET=<any 32+ characters> TRUSTED_PROXY_HOPS=1 UPLOAD_DIR=.e2e-uploads SITE_URL=http://localhost:5100 SMTP_HOST=127.0.0.1 SMTP_PORT=1025 npx next start --port=5100` (the other `webServer.env` values in `playwright.config.ts`; VAPID keys are generated per Playwright run, so push is off in a manual session unless you generate a pair with `npx web-push generate-vapid-keys`). Stop it by the PID listening on 5100 (`ss -ltnp | grep :5100`), never by a pattern that could match the owner's server, and check the port is free afterwards.
- **Database:** `blog_e2e` on the local MongoDB (`E2E_MONGODB_URI` overrides it). `e2e/seed.ts` resets and seeds it before the Playwright server starts; manual sessions reuse whatever the last run left unless seeded as above.
- **Uploads:** `UPLOAD_DIR=.e2e-uploads` keeps test files out of `uploads/`.
- **Email:** Mailpit (`docker compose --profile mail up -d mailpit`; SMTP on 1025, inbox at `http://localhost:8025`) receives every verification and reset email. Stop it at the end of a pass.
- **Geolocation:** the DB-IP City Lite file (`npm run geoip:download`) is passed to the test server when present; a test that needs a real location sets `X-Forwarded-For` to a public address on its browser context (`e2e/profile.spec.ts`).

## Test data and roles

| Role | Account | Notes |
|---|---|---|
| Admin | `e2e-admin@example.com` | Everything, including users, categories, publish requests, uploads |
| Author | `e2e-author@example.com` | Writes posts; owns the seeded posts |
| Reader | `e2e-reader@example.com` | Comments, votes, requests to publish |
| Moderator | none seeded | Create one with `createUser(name, "moderator")` |

All seeded accounts use the password in `e2e/fixtures.ts` (`PASSWORD`). `e2e/db.ts` has `createUser()`, `createPost()` and `withDb()` for extra data inside tests; `e2e/fixtures.ts` has `login()`, `newPage()` (a separate browser context per user), `expectNotification()` and `submitApplication()`. E2E specs import `test` and `expect` from `e2e/fixtures.ts`, which presets a cookie-consent choice.

## Commands

| Command | Purpose |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Build, then the Chromium end-to-end suite |
| `npm run test:e2e:browsers` | Build, then Chromium, Chrome, Edge, Firefox and a Pixel 7 viewport in turn |
| `npx playwright test --project=chromium e2e/<file>.spec.ts` | One spec against an existing build |

## Fixing a reported bug

Follow the verification loop in [method.md § 7](../kits/flow-qa/method.md#7-fixing-a-reported-bug-the-verification-loop). In this project:

- Reproduce on a manual session (above) with the Playwright browser; save screenshots in the agent's scratch directory, not the repository.
- Assert what a person sees: `expectSeen()` in `e2e/fixtures.ts` (scrolled into view, fully opaque); `clickNavLink()` for navbar links on desktop and phone.
- After a click that changes page, wait for something only the new page has (its heading) before filling a field: the old page stays on screen until the new one arrives, and a label both pages share (login and forgot-password both have "Email") fills the old page's field.
- To prove a test catches the bug after the fix is written: copy the fixed file aside, `git show HEAD:<path> > <path>`, `npx next build`, run the test with `-g`, then copy the fixed file back. Never use `git stash` (it changes the index).
- Sideways scrolling: `document.documentElement.scrollWidth === clientWidth` at 390 px.
- Review: in Claude Code, `/code-review high` with no target reviews the uncommitted diff; a commit hash as target reviews that commit instead.
- A failing e2e test: unzip its `trace.zip` from `test-results/` and read `*-trace.network` and the console entries in `*-trace.trace`; confirm a fix with `--repeat-each=5` on that test (mind the rate limits below).
- Then `npm run test:e2e:browsers`, the QA log in `docs/qa/checklist.md`, and a commit under decision D-13.

## Browsers and devices

Sessions explore in Chromium; layout checks add dark mode and a 390 px phone width. The full browser matrix runs once at the end of a pass. The push spec needs a browser with a push service and is skipped in projects without one.

## Project rules

- Rate limits are per process and per address, so `--repeat-each` trips them (10 comments a minute, 30 uploads an hour, 5 password changes per 15 minutes); a 429 in a repeated run is expected, not a bug.
- Streamed pages keep a hidden copy of some segments: assert on `.filter({ visible: true })` when text can appear twice.
- Comments render optimistically with a `temp-` id until the server answers; wait for the real id before using it.
- The owner's Claude budget is shared across projects: one flow group per session, accessibility snapshots for finding controls, Chromium while exploring; screenshots are still required after client-side navigations and look changes (method § 2 and § 7).
