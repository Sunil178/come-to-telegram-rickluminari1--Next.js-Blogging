# Flow document standard

A flow document describes one feature group of an app from the user's side: who uses it, how it works, every path through it, its rules, and which automated test proves each path. It serves four readers at once: a developer new to the code, an AI agent changing the feature, a support person or bot answering "how do I…?", and a tester planning a QA session.

## The practices it combines

The format is plain Markdown so it needs no extra tooling, and it borrows from three established practices:

- **Use cases** (Alistair Cockburn, *Writing Effective Use Cases*): an actor with a goal, preconditions, a numbered main success scenario, and extensions for alternate and error paths numbered after the step they branch from (`3a. The email is already registered: …`). This makes the unhappy paths as visible as the happy one, which is where most bugs live.
- **Living documentation** (the idea behind BDD and Gherkin, as described by Cyrille Martraire in *Living Documentation*): every scenario links to the automated test that checks it. When behaviour changes, the test fails until the test and the document are updated together, so the document can't silently go stale. Linking existing end-to-end tests by name gives the same guarantee as Gherkin without adding a Cucumber layer on top of the suite. A unit test ([templates/flow-docs.test.ts](templates/flow-docs.test.ts)) checks that every cited test exists and every test is cited.
- **Diátaxis** (Daniele Procida): flow documents are how-to and explanation material for one feature each. Reference material (configuration variables, API routes, data models) stays in the README and the code, and flow documents link to it instead of copying it.

Diagrams in Mermaid (rendered by GitHub, GitLab and most editors) are welcome where a picture is clearer than steps, such as a state diagram of an approval workflow or a sequence diagram of an email round trip.

## Rules

- **One document per flow group**, named after the group (`docs/flows/comments.md`). A group is an area a user would name; it usually holds 3 to 10 flows.
- **Write from the user's side.** Steps are what the user does and sees ("Clicks Reply. → A reply box opens under the comment."), not function calls. Steps never mention code; "How it works", "Side effects" and "Rules and limits" may name files, fields and settings, since that's where a developer or agent looks next.
- **Every flow ends with "Tested by"**: the end-to-end test file and test name that prove it, or "not automated yet" (which is a to-do, not a resting state).
- **Extensions cover what goes wrong**: invalid input, missing permission, logged out, rate limited, the other user acted first, the item was deleted.
- **Side effects are explicit**: emails, notifications, push messages, counters, data written or removed, audit records.
- **Rules and limits are concrete**: lengths, rate limits, roles, time-to-live values, with the number, not "a limit applies".
- **Present tense, current behaviour.** A flow document describes the system as it is. History goes in commit messages.
- **Keep it short.** A flow is a handful of steps; if it needs more, it is probably two flows.

## Template

See [templates/flow.md](templates/flow.md). The inventory that lists every group uses [templates/inventory.md](templates/inventory.md); coverage lives in each flow's "Tested by" line.
