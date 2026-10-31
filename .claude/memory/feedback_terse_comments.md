---
name: feedback-terse-comments
description: "Keep code comments to 1-2 lines; don't write multi-line explanatory comment blocks even for non-obvious framework behavior."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1e1cae2a-8e4b-42f8-91ca-a74066b02baa
  modified: 2026-08-15T09:54:18.218Z
---

Comments should be 1-2 lines max, even when explaining something genuinely non-obvious (e.g. a subtle framework quirk or a security-relevant design choice). Compress to the essential why, cut background exposition, examples, and step-by-step mechanism walkthroughs from the comment body.

**Why:** Corrected twice in one session (2026-08-15) — once on `src/seeds/seeder.ts` (multi-line comments on `LEGACY_POSTS` and several seeder functions), once on `src/components/ui/table-node.tsx` (a 5-line comment explaining a `@platejs/table` prop-merging quirk). Both times the fix was cutting to 1-2 lines without losing the core reasoning.

**How to apply:** Before writing any comment longer than 2 lines, compress it first — state the rule/fact and the one-clause reason, not the full investigation or mechanism. This applies even to tricky root-cause findings (e.g. tracing a bug into a library's internals) — the comment only needs to record *what* to watch for and *why* it matters, not the full derivation. If more context genuinely seems necessary, put it in the commit message or PR description instead of the code.
