---
name: feedback-commit-approval-default
description: "By default the owner reviews before every commit; I commit on my own only when they explicitly say so for that work. This repo's D-13 is such an explicit grant, for now."
metadata:
  type: feedback
---

Default: implement, run `/code-review high` on the uncommitted changes, fix its findings, then stop and ask the owner to review; commit only after they approve. Exception: when the owner explicitly tells me to commit myself and implement all the phases, I review properly on my own and commit each milestone without waiting.

**Why:** Owner, 2026-11-02: "when I explicitly say to commit by yourself and do implement all the phases, then no - you can review it properly without me. But default it has to go with me as a reviewer before making commits."

**How to apply:** In this repo, decision D-13 (docs/production-readiness/plan.md) is that explicit grant and stays in force for now, "subject to change later"; check whether it still applies before each commit. Small changes outside a D-13 milestone go to the owner first. Related: [[feedback-code-review-target]], [[project-production-readiness]].
