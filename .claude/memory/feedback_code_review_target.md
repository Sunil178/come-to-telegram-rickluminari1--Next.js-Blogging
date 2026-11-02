---
name: feedback-code-review-target
description: /code-review with a commit argument reviews that commit, not the working tree; run it with no target for uncommitted milestone work
metadata:
  type: feedback
---

`/code-review high <sha>` reviews the commit `<sha>` itself, not "everything since `<sha>`". For uncommitted milestone work, run `/code-review high` with no target (it reviews the current diff). For committed plus uncommitted work, review each separately.

**Why:** made this mistake twice (QA-M3 and the QA-15..19 round); each time a full high review was spent on an already-committed change while the new code went unreviewed, wasting the owner's weekly limit.

**How to apply:** before invoking, check what is uncommitted with `git status`; if the work is uncommitted, pass no target. See [[feedback-usage-pacing]].
