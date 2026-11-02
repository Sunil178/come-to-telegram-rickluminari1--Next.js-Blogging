---
name: feedback-verify-status-against-code
description: "Before telling the owner a feature is missing or an item is open, check the code and git log, not only docs; stale doc lines misled me once."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2d1d2828-6bf1-46bc-9e68-7a639ce0cd47
  modified: 2026-11-02T15:30:33.461Z
---

Before reporting anything as not done, missing or open, grep the code and `git log` for it; docs' "open items" lines can be stale.

**Why:** On 2026-11-02 I told the owner photo-location stripping and per-user upload limits weren't built, citing a stale line in docs/production-readiness/checklist.md; both had shipped in f5790c7 (QA-M3). The owner then asked me to build them.

**How to apply:** Any status claim in a report (done / not done / open) gets a code or commit check first; fix the stale doc line in the same change. The project's known-traps table (docs/kits/flow-qa/method.md § 8) lists this with the other testing mistakes. Related: [[feedback-verify-everything-yourself]], [[feedback-code-review-target]].
