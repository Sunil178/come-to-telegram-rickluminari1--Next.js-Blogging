---
name: project_production_readiness
description: Production-readiness initiative (started 2026-10-31) — owner authorized per-milestone commits without owner review; state lives in docs/production-readiness/.
metadata:
  type: project
---

Initiative M1–M8 plus final re-audit, tracked in `docs/production-readiness/checklist.md` (resume point after compaction). Owner explicitly authorized (2026-10-31) committing each milestone myself after vitest/tsc/lint/build, `/code-review high <base>`, and Playwright real-user verification — no per-milestone owner review; never push. GitHub token exposure in the `origin` remote URL is known; the owner will rotate it later — never print `git remote -v`.

**Why:** owner wants to review only at the end and asked me to verify as a real user with Playwright.

**How to apply:** this authorization covers staging + committing this initiative's milestone files only; still never push, never touch the owner's database or port 5000 (use port 5100 and a `blog_e2e` DB). Related: [[feedback_usage_pacing]], [[feedback_mandatory_todo]].
