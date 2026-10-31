---
name: feedback-never-unstage-git
description: "Never run git restore --staged or any unstaging command, even to undo my own accidental staging — tell the user instead."
metadata:
  type: feedback
  originSessionId: 1e1cae2a-8e4b-42f8-91ca-a74066b02baa
  modified: 2026-08-13T13:06:53.957Z
---

Never run `git restore --staged`, `git reset`, or any other command that unstages files — not even as a "fix" for a staging mistake I just made myself (e.g. an accidental `git rm -rf` or a tool like the shadcn CLI silently running `git add`).

**Why:** This project's CLAUDE.md is explicit: the user stages everything manually and relies on being able to distinguish their own staged changes from new ones. During Phase 5 editor migration, I ran `git rm -rf` (staging side effect) and then "corrected" it by running `git restore --staged .` across the whole repo — unstaging changes the user had staged by hand themselves, without being asked. The user was rightly angry: an unrequested destructive-to-workflow action doesn't become acceptable just because I'm the one who thinks something went wrong upstream. I should have reported the problem and asked, not acted.

**How to apply:** If I ever accidentally stage something (directly, or as a side effect of `git mv`, `git stash`, a CLI tool, etc.), do NOT run any unstaging command to clean it up myself. Stop, tell the user exactly what happened and what's now staged (`git status`), and let them decide whether/how to fix it. The only exception is being explicitly asked, in that moment, to unstage something specific.
