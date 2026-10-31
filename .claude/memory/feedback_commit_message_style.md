---
name: feedback-commit-message-style
description: "Commit message length should track what the change actually needs — shorten only when a draft turns out too long/padded, not as a fixed single-line rule."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1e1cae2a-8e4b-42f8-91ca-a74066b02baa
  modified: 2026-08-13T19:00:13.414Z
---

Write commit messages at whatever length the change warrants, checking `git log --oneline` for tone. This repo's history has both terse one-liners ("Update dependencies and refactor components") and longer messages for bigger changes (a bulleted "Harden API authorization, uploads, and route protection" commit was accepted without complaint). There is no fixed "always one line" rule.

**Why:** first drafted a long bulleted commit message that got rejected as "too long... very bad" — corrected that to "always default to a single line," which the user then explicitly corrected again: they never said to default to single line, only to shorten a message *when* it's too long. The actual rule is about trimming padding/bloat (restating the diff, over-explaining obvious rationale), not enforcing brevity as a default.

**How to apply:** Draft the message to fit the change. If it comes out long-winded — repetitive, padded, explaining things that don't need explaining — tighten it. If the change is genuinely large/multi-part, a longer message (semicolon-joined clauses or a short bulleted list, matching precedent already in this repo's history) is fine and not something to preemptively shrink. This is codified in `.claude/commands/commit.md` (the `/commit` command) in this repo.

**Bullet line-wrapping:** Don't hard-wrap a bullet across multiple lines at some fixed column width (e.g. ~80 chars) — that breaks it mid-sentence with a forced newline, which reads worse than one long line. Write each bullet as a single unbroken line, however long, and let the terminal/viewer soft-wrap it. Corrected after a draft hard-wrapped every bullet mid-clause; the repo's own history is inconsistent on this (some old commits wrap, some don't), but the more recent large multi-bullet commit (`1aa9990`, "Rebuild the public blog experience...") uses one unwrapped line per bullet — that's the pattern to follow.
