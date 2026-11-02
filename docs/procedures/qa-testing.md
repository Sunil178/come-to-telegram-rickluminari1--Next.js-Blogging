# QA testing procedure

How an agent (or a person) tests this app as a real user before calling a feature done. It complements the automated suites: unit tests prove logic, Playwright specs in `e2e/` prove the flows we already know about, and this procedure finds the ones nobody wrote down yet. Every bug it finds ends as a failing test, then a fix.

Sources this is distilled from: Anthropic's `webapp-testing` skill (reconnaissance before action, wait for the page to settle, read console logs), Playwright's test planner agent (Markdown test plans with independent, numbered scenarios covering happy paths, edge cases and errors), session-based exploratory testing (a charter and a time box per session), James Bach's SFDIPOT coverage heuristic, Elisabeth Hendrickson's test heuristics, and the FEW HICCUPPS consistency oracles.

## 1. Setup

- Production build on port 5100 against the `blog_e2e` database, never the owner's server (5000/3000) or database: `npx next build`, then the Playwright web server, or `PORT=5100 MONGODB_URI=mongodb://127.0.0.1:27017/blog_e2e npm start` for manual sessions. Mailpit (`docker compose --profile mail up -d mailpit`, UI on `http://localhost:8025`) receives every email.
- Seeded accounts (`e2e/seed.ts`): reader, author, moderator, admin, all with the e2e password. New accounts for a session come from `createUser()` in `e2e/db.ts` or the real registration form.
- Each role gets its own browser context (separate cookies), so cross-user effects (notifications, approvals, sign-outs) are seen from the other side, as a second real person would see them.
- Kill every server you started and check the ports are free before ending the turn.

## 2. One session per flow group

Pick the next group from the inventory in `docs/flows/README.md`. Write a one-line charter, for example: "Explore commenting as a reader and as the post's author, to find wrong counts, stale UI and permission gaps." Keep the session focused; note other bugs you trip over and move on.

Work reconnaissance-first: open the page, wait until it settles, take an accessibility snapshot (not a screenshot) to learn the real controls, then act. Read the browser console and the server log after every step; an error there is a finding even if the page looks fine.

## 3. What to vary (SFDIPOT)

| Factor | Ask |
|---|---|
| Structure | Every page, dialog, menu item and link of the group: does each one go somewhere sensible? Which `loading.tsx` and `not-found` shells does it inherit? |
| Function | Every action, including the rarely used ones (edit, delete, undo, restore, reject, re-request). |
| Data | Empty, one character, the maximum length and one over, whitespace only, Unicode and emoji, HTML and script text, very long words, duplicates, a deleted or foreign id in the URL. |
| Interfaces | The same action through the UI, the API route directly (wrong role, logged out, malformed body) and the email or push notification link. |
| Platform | Chromium, Firefox and a phone viewport; light and dark theme; keyboard only. |
| Operations | Each role (logged out, reader, author, moderator, admin) and the transitions between them (a reader just promoted, a user just deleted). |
| Time | Refresh mid-flow, back and forward buttons, two tabs, double-clicks, slow network, actions that land after another user's change, scheduled and expiring things (tokens, TTLs). |

## 4. Edge-case heuristics to run every time

- **State survives a reload.** After every action, reload: does the page still show what the action did? (The "Request to publish" button forgot a pending request on reload.)
- **Undo the input.** Type, then clear; filter, then remove the filter; open a dialog, cancel, reopen. The page must return to its original state. (Clearing the search kept the filtered list.)
- **The other side updates.** After user A acts, look at what user B sees: counters, bell badge, lists, emails. Stale state there is a bug. (An approved request stayed unread in the admin's bell.)
- **Do it twice.** Double-click submit buttons, repeat a request, open the same link twice; expect one effect and a clear message.
- **Loading shells match.** Throttle the network or hard-reload each page and check the skeleton belongs to that page. (The editor showed the posts grid skeleton.)
- **Affordance.** Everything clickable shows a pointer cursor and a focus ring, and works from the keyboard. Nothing non-clickable looks clickable.
- **Permissions both ways.** Each action is available to exactly the roles that should have it, in the UI and in the API.
- **Errors are humane.** Validation messages say what to do; server failures show a toast, never a blank page or a raw error.
- **Counts add up.** Vote, comment and visitor counts match the data after create, edit, delete and account deletion.

## 5. Oracles: deciding something is a bug (FEW HICCUPPS)

Behaviour is suspicious when it's inconsistent with: the app's own behaviour elsewhere (History, Image, Comparable products), what the user would reasonably expect (Claims in the UI text, User expectations), the purpose of the feature (Product, Purpose), or Standards and Statutes (accessibility, privacy). A familiar pattern from mainstream products (GitHub, Medium, dev.to) is a fair expectation.

## 6. Recording and closing findings

- Log each finding in the current QA pass report (`docs/qa/`) with steps to reproduce, expected versus actual, the role and browser, and severity (blocker, major, minor, polish).
- For a bug: write the failing Playwright test (or unit test for pure logic) first, fix the root cause and every instance of the pattern, then re-run the session's flows.
- For a missing feature or a product question: record it as a decision for the owner, don't build it unasked.
- Update the group's flow document in `docs/flows/` with anything the session taught about how the feature really behaves.

## 7. Usage pacing

The owner's weekly Claude limit is shared across many projects. Run one flow group per session, prefer accessibility snapshots over screenshots, run the chromium project unless a browser difference matters, and run the full multi-browser suite only at the end of a pass. Don't use Playwright's planner/generator/healer agent loop: it spawns one subagent per test case. Its Markdown plan format is reused in `docs/flows/` instead.
