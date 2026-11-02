---
name: project_production_readiness
description: Production-readiness initiative and QA pass 1 (docs/qa/); commits: owner re-authorized per-milestone agent commits on 2026-11-02 (D-13) after briefly revoking them (D-12).
metadata:
  type: project
---

Initiative M1–M8 plus final re-audit and M9 launch QA and hardening (commit 6124fa1), tracked in `docs/production-readiness/checklist.md`. EXIF, upload quotas and search scaling await owner decisions. On 2026-11-02 the owner first revoked commit authorization (D-12), then later the same day re-authorized it for QA pass 1: "Make commits by your own. And complete all in steady pace." (D-13). Commit each milestone after tests, review and real-browser verification; never push. GitHub token exposure in the `origin` remote URL is known; never print `git remote -v`.

**Why:** the owner found many real-user issues on their own after M9 and wants to review before anything lands.

**How to apply:** verify (vitest/tsc/lint, Playwright on port 5100 with `blog_e2e`), review, then commit the milestone; if the owner revokes again, stop committing. Never touch the owner's database or ports 5000/3000. Mailpit for e2e: `docker compose --profile mail up -d mailpit`. Related: [[feedback_usage_pacing]], [[feedback_verify_everything_yourself]].
