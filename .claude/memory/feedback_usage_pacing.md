---
name: feedback_usage_pacing
description: Conserve Claude Code weekly usage — user works across many repos all week; slow and steady is fine, burning the limit is not. Repeated as a hard rule on 2026-11-02.
metadata:
  type: feedback
---

Pace token use so the weekly plan limit lasts: prefer direct Read/grep over subagents, scope reviews to the diff, `/code-review medium` for ad-hoc reviews, never `max`/workflows/fan-out without an explicit ask, don't re-read files already in context, run the cheapest test project (chromium) unless a browser matters, keep web research to a few targeted searches. A steady slow pace across several turns is preferred over one expensive burst. Mandatory todo list for every multi-step task (see [[feedback_mandatory_todo]]).

**Why:** user stated (2026-10-31, again firmly 2026-11-02) they use Claude Code for many things across many repos; a slow pace is fine, burning the weekly limit is not.

**How to apply:** before spawning agents, heavy reviews or long browser runs, ask whether a cheaper direct approach gives the same answer; split large work into milestones across turns. Keep all Claude setup (skills, commands, memory) local to this repo's `.claude/`, not global. Mirrored as a "Usage pacing" bullet in ~/.claude/CLAUDE.md.
