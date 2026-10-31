# Plan — production readiness

Follows the review-gated delivery workflow (`~/.claude/delivery-workflow.md`) with the owner's adjustment recorded in the decision log (D-01): the agent commits each milestone itself after tests, a code review and Playwright verification; there is no per-milestone owner review.

## Milestones

| # | Milestone | Items |
|---|---|---|
| M1 | Security | SEC-01, SEC-02, SEC-03, SEC-04 |
| M2 | Hygiene and docs | DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-08 (documented) |
| M3 | Ops | OPS-01, OPS-02, OPS-03, OPS-04 |
| M4 | Containers | OPS-05, DOC-09 |
| M5 | Accounts | ACC-01, ACC-02 |
| M6 | Notifications v2 | NTF-01 … NTF-05, DOC-07 (documented) |
| M7 | Content | CNT-01 … CNT-04 |
| M8 | Visitor interests | VIS-01 … VIS-04 |
| — | Final re-audit | new Critical/High findings appended and fixed |
| M9 | Launch QA and hardening | LCH-01 … LCH-10 (from the owner's launch review, listed in the checklist) |

M1–M4 come first so later features get end-to-end tests and container support from the start.

## Per-item workflow

Re-verify → find every instance of the pattern → failing test first (except pure config/docs) → fix at the root cause → targeted tests, then `tsc`, lint, full `vitest` → docs in the same change → checklist entry updated.

## Closing a milestone

1. Full `vitest`, `tsc`, lint, `next build` green.
2. `/code-review high <base>` over the milestone; verified findings fixed, the rest dismissed with a reason in the checklist.
3. Playwright verification as a real user against the production build on a separate port and an isolated database (never port 5000, never the owner's database).
4. Commit (one per milestone unless genuinely unrelated changes), checklist updated with the hash in the next milestone's commit.

## Testing strategy

- Unit and route tests: Vitest with mocked models (existing pattern).
- End-to-end: Playwright (`e2e/`), run against `next build && next start` on port 5100 with `MONGODB_URI` pointing at a dedicated `blog_e2e` database that the suite seeds and drops. Email flows use Mailpit (SMTP on 1025, API on 8025) started via Docker.
- Dev servers or production servers started by the agent are always stopped before the turn ends and the port is verified free.

## Decision log

- **D-01 (2026-10-31):** The owner explicitly authorizes the agent to commit each milestone without a per-milestone owner review; the agent verifies with tests, `/code-review high`, and Playwright user flows instead. Never push.
- **D-02:** Reverse proxy: optional Caddy service in Docker Compose (automatic HTTPS). The app reads the client IP through `TRUSTED_PROXY_HOPS` or `CLIENT_IP_HEADER`, so it also works behind nginx, Cloudflare, or a platform proxy.
- **D-03:** Email via SMTP (nodemailer) configured from env; Mailpit locally. Provider-specific APIs (Resend, SES) later.
- **D-04:** GitHub Actions CI/CD is documented, not added (owner's call).
- **D-05:** Upload storage and the shared (Redis) rate limiter are deferred and documented.
- **D-06:** Notification TTL applies to read notifications only, `NOTIFICATION_READ_TTL_DAYS` (default 90; `0` disables).
- **D-07:** Visitor tracking uses a first-party random cookie plus TTL'd events, stitched to the user on login/registration, gated by a consent banner. Replaces the fingerprint.js idea and the unused `TempUser` / `UserInterest` models.
- **D-08:** PWA icons are generated from the wordmark until the owner supplies a logo.
- **D-09 (2026-10-31):** Account deletion is self-service and permanent. The user record, their posts (with revisions, comments, votes and notifications on them), votes, notifications they received or caused, push subscriptions, tokens, publish requests and reading history are hard-deleted, and vote counts on other content are corrected. Their comments on other people's posts are emptied and soft-deleted, so replies keep their thread under a "[deleted]" placeholder. Revision entries recording their edits of other people's posts stay, because they hold the post owner's earlier text; the editor then shows as unknown. Uploaded images are removed unless another post still uses them. The last admin can't delete their account (admin deletions are serialized). The data export includes the same records, plus revisions of their posts and the versions their edits replaced.
- **D-10 (2026-10-31):** The bundled `mongo:8` service sets `GLIBC_TUNABLES=glibc.pthread.rseq=1`, the published workaround for SERVER-121912 (mongod 8 refuses to start on Linux 6.19+). Costs some allocator performance; remove once MongoDB ships a fix.
- **D-11 (2026-10-31):** Local staging runs the full Compose stack with Caddy's internal CA on `https://localhost:8443` and `skip_install_trust`, so nothing is installed into the host's trust store; Mailpit stands in for the SMTP provider.
