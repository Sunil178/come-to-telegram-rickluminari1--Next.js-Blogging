# QA method

How an agent or a person tests a web app as a real user before calling a feature done. It complements the automated suites: unit tests prove logic, end-to-end tests prove the flows already written down, and this method finds the ones nobody wrote down yet. Every bug it finds ends as a failing test, then a fix. Project specifics (servers, test data, accounts) come from the project profile (see [templates/project-profile.md](templates/project-profile.md)).

Distilled from: Anthropic's `webapp-testing` skill (reconnaissance before action, wait for the page to settle, read console logs), Playwright's test planner agent (Markdown test plans with independent, numbered scenarios covering happy paths, edge cases and errors), session-based exploratory testing (Jonathan and James Bach: a charter and a time box per session), James Bach's SFDIPOT coverage heuristic, Elisabeth Hendrickson's *Explore It!* test heuristics, and the FEW HICCUPPS consistency oracles (Michael Bolton and James Bach).

## 1. Isolation first

Test against a production build on its own port and its own database, never a developer's running server or real data. Capture outgoing email with a local catcher. Give each role its own browser context (separate cookies), so effects across users (notifications, approvals, sign-outs) are seen from the other side, as a second real person would see them. Stop every server you started and check its port is free before you finish.

## 2. One session per flow group

Pick the next group from the project's flow inventory. Write a one-line charter, for example: "Explore commenting as a reader and as the post's author, to find wrong counts, stale UI and permission gaps." Keep the session on its charter; note other bugs you trip over and move on.

Work reconnaissance-first: open the page, wait until it settles, take an accessibility snapshot (cheaper and more exact than a screenshot) to learn the real controls, then act. Read the browser console and the server log after every step; an error there is a finding even if the page looks fine. Snapshots tell you what is in the page, not what a person sees: also take a screenshot after every client-side navigation (search, filter, paging, back) and after every change to a page's look, and check dark mode, phone width and sideways scrolling (the page's `scrollWidth` equals its `clientWidth`).

## 3. What to vary (SFDIPOT)

| Factor | Ask |
|---|---|
| Structure | Every page, dialog, menu item and link of the group: does each one go somewhere sensible? Which loading and not-found states does it show? |
| Function | Every action, including the rarely used ones (edit, delete, undo, restore, reject, retry, request again). |
| Data | Empty, one character, the maximum length and one over, whitespace only, Unicode and emoji, HTML and script text, very long words, duplicates, impossible dates, a deleted or foreign id in the URL. |
| Interfaces | The same action through the UI, the API directly (wrong role, logged out, malformed body) and any email or push notification link. |
| Platform | The browsers the project supports and a phone viewport; light and dark theme; keyboard only. |
| Operations | Each role, logged out included, and the transitions between them (a user just promoted, demoted or deleted). |
| Time | Refresh mid-flow, back and forward, two tabs, double-clicks, slow network, actions that land after another user's change, scheduled and expiring things (tokens, time-to-live values, grace periods). |

## 4. Edge-case heuristics to run every time

- **State survives a reload.** After every action, reload: does the page still show what the action did?
- **Undo the input.** Type, then clear; filter, then remove the filter; open a dialog, cancel, reopen. The page must return to its original state.
- **The other side updates.** After user A acts, look at what user B sees: counters, badges, lists, emails. Stale state there is a bug.
- **Do it twice.** Double-click submit buttons, repeat a request, open the same link twice; expect one effect and a clear message.
- **Loading states match.** Throttle the network or hard-reload each page and check the loading skeleton belongs to that page.
- **Affordance.** Everything clickable shows a pointer cursor and a focus ring, and works from the keyboard. Nothing non-clickable looks clickable.
- **Permissions both ways.** Each action is available to exactly the roles that should have it, in the UI and in the API.
- **Errors are humane.** Validation messages say what to do; server failures show a message, never a blank page or a raw error.
- **Counts add up.** Every counter matches the data after create, edit, delete and account deletion.
- **Private stays private.** Data marked private (personal details, file metadata, other users' email addresses) appears only where it should: check public pages, exports, feeds and API responses.

## 5. Oracles: deciding something is a bug (FEW HICCUPPS)

Behaviour is suspicious when it's inconsistent with: the product's own behaviour elsewhere (History, Image, Comparable products), what a user would reasonably expect (Claims made in the UI text, User expectations), the purpose of the feature (Product, Purpose), or Standards and Statutes (accessibility, privacy law). A pattern familiar from mainstream products is a fair expectation.

**Present is not seen.** An element can be in the page, pass every text and role assertion, and still be invisible to a person: at opacity 0 behind an entrance animation that didn't re-run, clipped, covered, or off-screen. Playwright's `toBeVisible()` counts an element at opacity 0 as visible. So:

- In every manual session, take a screenshot after each client-side navigation (search, filter, paging, back) and look at it, rather than reading the DOM alone.
- In end-to-end tests of anything that animates in, assert what a person sees: scroll to the element, then check that it and its ancestors are fully opaque (a helper that multiplies the computed `opacity` up the tree).
- Check numbers a person reads (counters, totals, scores) against what a person expects each click to do, not only against the database. A number that is correct but jumps by two reads as a bug.

## 6. Recording and closing findings

- Log each finding in the current QA pass (see [templates/qa-pass.md](templates/qa-pass.md)) with steps to reproduce, expected versus actual, the role and browser, and severity: blocker, major, minor, polish.
- For a bug: write the failing end-to-end test (or a unit test for pure logic) first, fix the root cause and every instance of the pattern, then re-run the session's flows.
- For a test that fails without an app bug (a race in the test, a shared fixture, a rate limit hit by repeated runs), fix the test and say so; don't loosen the app.
- For a missing feature or a product question: record it as a decision for the owner; don't build it unasked.
- Update the group's flow document with anything the session taught about how the feature really behaves.

## 7. Fixing a reported bug: the verification loop

When a person reports a bug, the report is evidence that the earlier testing missed something. Work through every step; skipping one is how the next miss happens.

1. **Reproduce it as they did.** Same page, same steps, in a real browser on the isolated build, and look at a screenshot. If it doesn't reproduce, find out why before changing anything.
2. **Find the root cause and every instance.** Ask why the symptom happens until the answer is a line of code, then search the codebase for the same component or idiom and fix each one.
3. **Explain the miss.** Work out why the earlier tests passed (a weak assertion, an untested path, a step only done by hand). The new test must close that gap, and a lesson that applies beyond this bug goes into this method.
4. **Prove the test catches it.** Write the test so it asserts what the person saw. Run it against the unfixed code and watch it fail; if the fix is already written, swap the old code back in for one run and restore it after. A test that never failed proves nothing.
5. **Fix, then run the fast checks:** unit tests, type check, lint.
6. **Look at it.** Screenshots of every page the change touches, in light and dark mode and at phone width; check for sideways scrolling. Fix what looks wrong even if every test passes.
7. **Review the change independently.** Have a reviewer (a person or a fresh agent) review the uncommitted diff itself, not an older commit. Fix what holds up, then repeat steps 5 and 6 for the changes the review caused.
8. **Run every supported browser.** For each failure, read the trace before changing anything: an app bug gets a fix, while a race in the test gets a test fix that you report as one. Confirm a flaky fix by repeating that test several times.
9. **Close it out.** Update the flow document and the QA log, stop every server you started and check the ports are free, then report plainly: what was wrong, why it was missed, what changed, and the test results.

## 8. Pacing

Agent sessions cost tokens, and the person paying often shares that budget across projects. Run one flow group per session, prefer accessibility snapshots for finding controls (screenshots stay mandatory where section 2 and section 7 ask for them), run one browser while exploring and the full browser matrix only at the end of a pass, and avoid agent loops that spawn one sub-agent per test case (such as Playwright's planner, generator and healer agents); this kit reuses their Markdown plan format instead.
