---
name: feedback-verify-everything-yourself
description: Before calling anything production-ready, verify every feature myself in real browsers (multiple accounts, Chrome/Edge/Firefox/mobile), staging stack and load test — never list "not verified" items as the user's job.
metadata:
  type: feedback
---

When assessing readiness, I must test every flow myself as a real user: multiple accounts in independent browser contexts, the installed Chrome and Edge plus Playwright Firefox and a phone viewport, the full Docker stack (Caddy HTTPS with local CA, Mailpit as SMTP), real Web Push, and a load test. Only things that genuinely need the owner (a real domain/server, real SMTP credentials, product decisions) may be left to them.

**Why:** On 2026-10-31 the owner pushed back on a readiness answer that listed untested flows: "you should be doing this. What is blocking on you here?" Doing it found real bugs (a server-crashing memory leak, push toggle hanging forever, deleted accounts keeping sessions).

**How to apply:** Treat "not verified" as my to-do, not a caveat. Local tooling exists: `deploy/staging.sh`, `npm run test:e2e:browsers`, `e2e/load/run.mjs`. Never install anything system-wide (no trust-store or /etc changes). See [[usage-pacing]] for keeping it affordable.
