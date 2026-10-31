---
name: feedback_mandatory_todo
description: Every task in every chat must be tracked in a live todo list (load deferred TodoWrite first) so the user can monitor progress and ETA.
metadata:
  type: feedback
---

Create the todo list at the start of any multi-step task, keep exactly one item in progress, update it the moment status changes, and post short done/in-progress/next notes during long runs. In the VS Code extension TodoWrite is deferred — load it via ToolSearch at session start and after /compact.

**Why:** user (2026-10-31) wants everything monitorable — where Claude is, what's done, what's pending, how long it may take — and made it mandatory for every chat. Related: [[feedback_usage_pacing]].

**How to apply:** first tool call of a multi-step turn is loading/creating the todo list; also enforced by the SessionStart hook and ~/.claude/CLAUDE.md "Live progress".
