---
name: qa-testing
description: Use when testing a feature or flow of this app as a real user (exploratory QA, fixing or verifying a reported bug end to end, a QA pass over a flow group, or writing a flow document in docs/flows/).
---

Read and follow the project profile in `docs/procedures/qa-testing.md` and the QA method in `docs/kits/flow-qa/method.md`. Flow documents follow `docs/kits/flow-qa/flow-doc-standard.md`; the inventory is `docs/flows/README.md`.

For a bug someone reported, follow the verification loop (method § 7, with the project's specifics under "Fixing a reported bug" in the profile) step by step, and keep each step as its own item in the todo list. To review the change, run `/code-review` with no target: given a commit, it reviews that commit instead of the uncommitted diff.
