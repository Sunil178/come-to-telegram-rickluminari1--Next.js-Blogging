---
description: Create a git commit message for the currently-staged changes with a single, conclusive commit message
---

Create a commit for whatever is currently staged in git, following this project's commit conventions exactly:

Do not run `git commit` — only output the message(s) unless the user explicitly asks you to commit.

1. Never run `git add`, `git restore --staged`, or anything else that changes what's staged. Only work with what is staged right now — see the `repo-workflow-safety` skill for why this matters in this project.
2. Run `git status` and `git diff --cached` to see the full staged diff. If nothing is staged, stop and tell the user to stage what they want committed first — do not stage anything yourself, even to be helpful.
3. Look back over the conversation for the context behind the staged changes: the problem being solved, decisions made along the way, and why — not just the raw diff. A mechanical diff summary misses the point of this command.
4. Draft ONE final commit message describing the end result as if it had been written correctly on the first attempt. Do not include a trail of intermediate fix-ups, corrections, or "address review feedback" style entries, even if that's literally how the work happened turn by turn in conversation.
5. Write it at whatever length the change actually warrants — check `git log --oneline -10` for tone. A small change gets one short line; a large one can span multiple clauses (this repo's history has both single-line subjects and longer semicolon-joined or bulleted messages for bigger changes). If the draft comes out long-winded — padded with restating the diff, over-explaining obvious rationale, redundant clauses — tighten it down. Length should track what actually needs saying, not a fixed target in either direction.
6. Show the drafted message to the user.

$ARGUMENTS
