---
name: feedback_usage_pacing
description: Conserve Claude Code weekly usage — user works across many repos all week; 5-hour block OK, week-long block not.
metadata:
  type: feedback
---

Pace token use so the weekly plan limit lasts: prefer direct Read/grep over subagents, scope reviews to the diff, `/code-review medium` for ad-hoc reviews (milestone gates keep `high`), never `max`/workflows/fan-out without an explicit ask, don't re-read files already in context. Mandatory todo list for every multi-step task (see [[feedback_mandatory_todo]]).

**Why:** user stated (2026-10-31) they work on many aspects of many repos through the week and can tolerate a 5-hour session block but not a week-long one.

**How to apply:** before spawning agents or running heavy review levels, ask whether a cheaper direct approach gives the same answer; mirrored as a "Usage pacing" bullet in ~/.claude/CLAUDE.md.
