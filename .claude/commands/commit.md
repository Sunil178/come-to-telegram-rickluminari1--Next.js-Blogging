---
description: Draft a git commit message for the currently-staged changes, describing only the final implementation (no debugging/iteration narrative)
---

Draft a git commit message for whatever is currently staged in git, following this project's commit conventions exactly. Do not run `git commit` — only output the message unless the user explicitly asks you to commit. Do not add a "Co-Authored-By" line here — that's only added when actually running `git commit`, per the user's standing git workflow.

## Rules

1. Never run `git add`, `git restore --staged`, or anything else that changes what's staged. Only work with what is staged right now — see the `repo-workflow-safety` skill for why this matters in this project.
2. Run `git status`, `git diff --cached --stat`, and `git diff --cached`. Read the full staged diff, not just the stat summary — the message must be grounded in what actually changed, not guessed from file names. If nothing is staged, stop and tell the user to stage what they want committed first — do not stage anything yourself, even to be helpful.
3. Look back over the conversation for the context behind the staged changes: the problem being solved, decisions made along the way, and why — not just the raw diff. A mechanical diff summary misses the point of this command.
4. Draft ONE final commit message describing the end result as if it had been built correctly on the first attempt.

## What the message describes

Describe only the final implementation — end-state behavior and structure, not the process that produced it. Never mention: intermediate or superseded approaches, bugs that were introduced and fixed within the same piece of work, debugging steps, or how many iterations it took. If the staged diff spans several files for one coherent change, describe it as one capability, not a list of file edits.

Don't narrate file-by-file mechanics the reader can get from the diff itself (e.g. "updated imports in layout.tsx") — describe the resulting capability or behavior instead.

## Format

Match this repo's existing style for tone. This is a plain descriptive title, not conventional-commit prefixes like `feat:`/`fix:`. The repo's history has both:
- a single-line subject for a small, single-purpose change, and
- a title plus semicolon-joined clauses or bullet points for a larger, multi-part change.

For a large or multi-part change, prefer a one-sentence title stating the overall capability, then a handful of bullets (roughly 3-6) for the genuinely distinct sub-parts — not one bullet per file or per component.

Keep it readable, not exhaustive:
- One idea per bullet, one line where it fits, two lines at most. If a bullet needs a third line, it's actually two bullets — split it.
- Don't enumerate every instance of something (every component, every route, every field) — say what changed and, if useful, a representative example, not the full list. The diff is the exhaustive record; the commit message is the summary a person reads without opening it.
  - Bad: "Adds shadcn Avatar, DropdownMenu, Sheet, and Separator; rebuilds Navbar.tsx, NavbarBar.tsx, NavLinks.tsx, UserMenu.tsx, MobileNav.tsx, Footer.tsx, and GlobalLoader.tsx"
  - Good: "Rebuild Navbar, Footer, and GlobalLoader on shadcn/ui and Motion, replacing the remaining antd usage in the shared layout"

Write it at whatever length the change actually warrants — length should track what actually needs saying, not a fixed target in either direction. If the draft comes out long-winded — padded with restating the diff, over-explaining obvious rationale, redundant clauses — tighten it down rather than wrapping more lines.

## Output

Show the drafted message to the user inside a single fenced code block (plain text, no language tag) so it renders as one copyable block instead of formatted markdown — bullets in the message should be literal `- ` lines inside that block, not markdown list items outside it. Ready to paste into `git commit`.

$ARGUMENTS
