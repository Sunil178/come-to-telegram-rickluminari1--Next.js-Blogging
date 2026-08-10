# Repository instructions for Claude Code

## Git

Never stage or unstage changes (`git add`, `git restore --staged`, `git reset`, `git stash`, `git mv`, etc.) unless explicitly asked for that specific action in that moment — the user stages everything manually themselves and relies on being able to distinguish their own staged changes from new ones. See the `repo-workflow-safety` skill for known gotchas (e.g. `git mv` and `git stash` both have staging side effects). Use `/commit` once the user has staged what they want committed — it drafts a single conclusive commit message instead of a trail of fix-up commits.

## Dev server

Runs on port 5000 in this project (`npm run dev -- --port=5000`), not the Next.js default 3000 — another project on this machine already uses 3000. Check whether a server is already running before starting a new one or deleting `.next`. See the `repo-workflow-safety` skill.

## API routes

Route Handlers (`src/app/api/**/route.ts`) must not contain inline auth logic — wrap them with `withApiGuard` from `src/libs/api-guard.ts`. See the `api-route-security` skill for the pattern and the reasoning behind it.
