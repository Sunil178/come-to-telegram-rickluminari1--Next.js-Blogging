# Flow docs and QA kit

A self-contained kit for documenting a web app's user flows and testing them the way a real user would. It works in any project with a browser UI and an end-to-end test suite (Playwright here, but nothing depends on it). Copy the folder to `docs/kits/flow-qa/` in another repository and it works as-is: nothing in it names this project. At a different path, update the paths in `templates/` (the skill, inventory and project profile point at `docs/kits/flow-qa/`).

It gives a project two things that reinforce each other:

- **Flow documents**: one Markdown file per feature group, describing for a newcomer, an AI agent or a support bot how the feature works from the user's side and where its logic lives. Every scenario names the automated test that proves it, so the documents stay true.
- **A QA method**: how an agent or a person explores a flow group as each kind of user, which edge cases to vary, how to decide something is a bug, and how each finding becomes a failing test, then a fix, then an updated flow document.

## Contents

| File | Purpose |
|---|---|
| [flow-doc-standard.md](flow-doc-standard.md) | The flow document format and the industry practices it combines |
| [method.md](method.md) | The QA procedure: sessions, reconnaissance, coverage heuristics, edge cases, oracles, recording findings |
| [templates/flow.md](templates/flow.md) | Skeleton for one flow group's document |
| [templates/inventory.md](templates/inventory.md) | Skeleton for the project's flow index (`docs/flows/README.md`) |
| [templates/project-profile.md](templates/project-profile.md) | Skeleton for the project-specific QA setup: servers, test data, accounts, email capture, commands |
| [templates/qa-pass.md](templates/qa-pass.md) | Skeleton for a QA pass checklist and findings log |
| [templates/claude-skill.md](templates/claude-skill.md) | A thin Claude Code skill that points an agent at the method and the project profile |
| [templates/flow-docs.test.ts](templates/flow-docs.test.ts) | A Vitest check that fails when a flow document cites a missing test, an e2e test is cited nowhere, or a linked file is missing |

## Adopting it in a project

1. Copy this folder to `docs/kits/flow-qa/` (another path works if you update the paths in `templates/`).
2. Create `docs/flows/README.md` from `templates/inventory.md` and list the app's flow groups: one per area a user would name ("Accounts", "Comments", "Billing"), usually 8 to 15.
3. Create the project profile, for example `docs/procedures/qa-testing.md`, from `templates/project-profile.md`: how to start an isolated server and database, the seeded accounts per role, where emails land, and which commands run the suites.
4. Point the agent instructions at it: one line in `AGENTS.md` (or the equivalent) saying QA follows the project profile and this kit's `method.md`. For Claude Code, add `.claude/skills/qa-testing/SKILL.md` from `templates/claude-skill.md`.
5. Copy `templates/flow-docs.test.ts` into the unit test suite (adjusting the paths), so the documents' citations are checked on every run.
6. Start a QA pass from `templates/qa-pass.md` (for example `docs/qa/checklist.md`), then work through the inventory one flow group per session. Each session either confirms a flow or ends in failing tests and fixes, and leaves that group's flow document written or updated.

## What stays project-specific

The kit holds only what is true for any app. Ports, databases, seeded users, mail capture, browsers to cover, rate limits and the flow documents themselves belong to the project and live outside this folder. When the method improves, change it here and copy the folder to the other projects that use it.
