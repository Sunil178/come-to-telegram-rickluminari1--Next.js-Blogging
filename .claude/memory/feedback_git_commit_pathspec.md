---
name: feedback-git-commit-pathspec
description: "git commit with no pathspec commits the whole index, not just what was just git add-ed — always pass an explicit pathspec or verify the index first."
metadata:
  type: feedback
  originSessionId: 1e1cae2a-8e4b-42f8-91ca-a74066b02baa
  modified: 2026-08-14T05:26:54.920Z
---

`git commit -m "..."` with no trailing pathspec commits everything currently staged, not just the file(s) just `git add`-ed in the same breath. Running `git add .gitignore && git commit -m "..."` when the index already held other pre-staged files (the user's own staged work) swept all of it into one commit under a message that only described the `.gitignore` change.

**Why:** During Phase 7 setup, the user had already staged `docs/revamp-plan.md` and a new plan doc themselves. I ran `git add .gitignore` then a bare `git commit -m "..."`, which silently included those two files too. Caught it immediately via `git show --stat HEAD`, asked the user how to fix it, then did `git reset --soft HEAD~1` (undoes the commit only, re-stages everything exactly as before — safe, not a "never unstage" violation since nothing was unstaged, just uncommitted) followed by `git commit <specific-file> -m "..."` to commit only the intended file. See [[feedback_never_unstage_git]] for the adjacent rule this is not a violation of.

**How to apply:** Whenever committing while other files might already be staged (always check `git status` first), pass an explicit pathspec to `git commit` (e.g. `git commit path/to/file -m "..."`) rather than a bare `git commit -m "..."`, even right after a targeted `git add`. If a bare commit happens to sweep in extra files, `git reset --soft HEAD~1` is the safe correction (preserves staging, only undoes the commit) — do this immediately and re-commit correctly rather than leaving a wrong commit in place.
