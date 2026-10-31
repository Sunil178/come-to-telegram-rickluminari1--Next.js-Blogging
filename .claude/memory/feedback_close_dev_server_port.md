---
name: feedback-close-dev-server-port
description: "Always kill the dev server if I started it manually for testing, so the user can run their own on port 5000."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1e1cae2a-8e4b-42f8-91ca-a74066b02baa
  modified: 2026-08-13T13:06:43.317Z
---

If I start the Next.js dev server myself (e.g. via `npm run dev -- --port=5000`) to verify a change with Playwright or similar, I must kill that process as soon as I'm done verifying — do not leave it running in the background.

**Why:** The user runs their own dev server on port 5000 in their terminal (per this project's CLAUDE.md) and needs it free to see live logs. This was violated twice in one project: once during initial ember/canvas work, and again during the whole Phase 5 editor migration (a `next-server` process was left bound to port 5000 through several rounds of Playwright end-to-end testing and only found when the user pointed out the port was still open). The check was skipped both times, not forgotten in principle — it needs to be an actual command run right before ending the turn, not a mental note.

**How to apply:** Before ending ANY turn where I started the dev server at any point in the session (even much earlier, even if I think I already closed it) — literally run `ss -ltnp | grep :5000` or `lsof -i :5000` and kill whatever PID shows up bound to that port. Do not trust memory of having closed it; verify freshly every time. This applies project-wide, not just to canvas/background work or Playwright testing — any time I launch `npm run dev` (or similar) for verification, close it afterward and confirm the port is actually free before reporting the task done.
