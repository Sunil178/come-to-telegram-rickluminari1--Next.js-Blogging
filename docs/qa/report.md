# QA pass 1 report

A real-user QA pass over the whole blog, done on 2026-11-02 (commits 846b70d to 503b23a, plus the follow-up below), following `docs/procedures/qa-testing.md` and the kit in `docs/kits/flow-qa/`. The detailed log, with every finding, decision and review result, is `docs/qa/checklist.md`; this page is the summary.

## What was tested, and how

- Every flow group in `docs/flows/README.md` (12 groups), as each role: logged out, reader, author, moderator, admin, in separate browser sessions so effects across users were seen from the other side.
- In a real browser against a production build on port 5100 and the `blog_e2e` database, with real email (Mailpit), real geolocation (DB-IP City Lite) and real image files; layouts checked in light and dark mode and at phone width.
- Each milestone ended with unit tests, the Chromium end-to-end suite, an independent code review at high effort with its findings fixed, and a commit.

## Results

| Suite | Result |
|---|---|
| Unit (Vitest) | 407 passed |
| E2E Chromium | 58 passed, 1 skipped (push needs a browser push service) |
| E2E Chrome | 59 passed |
| E2E Edge | 59 passed |
| E2E Firefox | 58 passed, 1 skipped (push) |
| E2E Pixel 7 (phone) | 58 passed, 1 skipped (push), after fixing two tests that assumed a desktop: one expected a single toast where the phone still showed the previous one, one clicked a navbar link that sits behind the phone menu |

Type-check clean; lint has 2 old warnings and no errors.

## What changed

| Milestone | Commit | Outcome |
|---|---|---|
| Owner-reported issues (QA-01..06) | 846b70d | Search clear, pending request state, bell cursor, stale admin bell, editor skeleton fixed; QA procedure added |
| M1: coverage for untested features (QA-07..14) | b136878 | Specs for comments, votes, admin, moderation, reading; categories in the editor, resubmission of rejected posts, moderator notifications, rejection reasons, confirmations, admin search and paging, `<main>` and footer on every page |
| M2: profiles and applications | 55adeb4 | Public and private profile, photo, change password, application form saved to the profile, admin review page with sign-up, sign-in and request addresses and locations |
| M3: uploads | f5790c7 | Metadata (GPS included) stripped from served images and kept privately; env limits for size, daily count, storage and rate; admin uploads report with download and delete (one, selected, all) |
| M4: search | dfb1781 | Weighted text-index search (stemmed, relevance-ranked, half-typed words still match titles); related posts bounded |
| M5: flow docs and QA kit | b655fc7 | Reusable kit in `docs/kits/flow-qa/`, 12 flow documents, a unit test that keeps their test citations true, a not-found test |

Bugs found by the pass itself (beyond the owner's reports) include: posts couldn't be given a category, rejected posts could never be resubmitted, moderators were never told about waiting posts, PNG uploads would have been quantised to 256 colours, the uploads cleanup could have deleted images still used by a revision or a post being written, a geolocation file installed after start-up stayed off until a restart, impossible birth dates were accepted, and plain text search would have matched any word of a query. Each has a test.

## Owner follow-up round

After this report, the owner found that clearing the search or paging left the posts list blank, that vote counts jumped by two, that the account page's sections didn't look separate, and that the menus weren't ordered by use. The blank list had passed the suite because Playwright counts an element at opacity 0 as visible and the manual sessions didn't look at screenshots after client navigations. All four are fixed (QA-15..18 in the checklist). The specs now check what a person sees (`expectSeen()`), the kit's method requires a screenshot after each client navigation, and every browser project was re-run: unit 411 passed; Chromium, Firefox and Pixel 7 59 passed with the push test skipped; Chrome and Edge 60 passed. The re-run also exposed a Firefox-only race in the profile test (its reload cancelled the page's own refresh after a photo upload), fixed in the test.

## Research behind the method

The kit combines established practice, each named in `docs/kits/flow-qa/method.md` and `flow-doc-standard.md`: Anthropic's `webapp-testing` skill (reconnaissance before action), Playwright's test planner format, session-based exploratory testing, SFDIPOT, Hendrickson's heuristics and the FEW HICCUPPS oracles for QA; Cockburn use cases, living documentation and Diátaxis for flow documents. Playwright's planner, generator and healer agents were not adopted: they run one sub-agent per test case, which costs far more than this project's budget allows.

## Open items

- Owner decisions: none pending from this pass.
- Not automated: Web Push runs only in the Chrome and Edge projects (it needs a browser push service).
- Limits by design: rate limits are per process (one app instance until a shared store exists, see `docs/roadmap.md`); search has no typo tolerance and matches whole words (Atlas Search or Meilisearch later).
