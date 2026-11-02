# User flows

One document per flow group describes, for a newcomer, an AI agent or a support bot, how a feature works from the user's side and where its logic lives. Each document doubles as the QA test plan for its group (`docs/procedures/qa-testing.md`), and each scenario names the Playwright test that proves it, so the docs stay true: when behaviour changes, the test fails until the doc and test are updated together.

## Format

The format combines three established practices, kept in plain Markdown so it needs no extra tooling:

- **Use cases** (Alistair Cockburn): actor, preconditions, a numbered main success scenario, then extensions for alternate and error paths (`3a. The email is already registered: …`).
- **Living documentation** (the idea behind BDD/Gherkin): every scenario links to the automated test that checks it. We link Playwright tests instead of writing Gherkin, which would add a Cucumber layer on top of the suite we already have.
- **Diátaxis**: these are how-to and explanation documents for one feature each; reference material (env variables, API routes) stays in the README and code.

Mermaid diagrams (rendered by GitHub) are welcome where a picture is clearer than steps, for example a state diagram of a post's approval.

## Template

```markdown
# <Group name>

**Who:** roles that use it. **Entry points:** pages, links and emails that lead here.

## How it works
Two to five sentences on the core logic, with links to the main files (actions, routes, models, libs).

## Flows
### 1. <Flow name>
**Preconditions:** starting state.
1. Step the user takes. → What they see.
2. …
**Extensions:**
- 2a. <Alternate or error condition>: what happens.
**Side effects:** emails, notifications, push, data written, counters changed.
**Tested by:** `e2e/<file>.spec.ts` › "<test name>" (or "not automated yet").

## Rules and limits
Validation rules, rate limits, permissions per role, TTLs.
```

## Inventory

| Group | Covers | Flow doc | E2E coverage today |
|---|---|---|---|
| Accounts | Register, verify email, sign in, sign out, forgot and reset password, lockout, session revocation | to write | register+verify, reset, unknown-email reset, reset signs out other browsers, wrong password, gated redirects |
| Account self-service | Account page, profile and photo, change password, data export, account deletion, privacy page | to write | export, deletion, privacy page, 8-character rule, profile, photo, change password |
| Reading | Home, posts list (search, categories, pagination), post page, related posts, author profile, RSS, sitemap | to write | related posts, search clear, pagination, category filter, author profile, RSS, sitemap, robots, theme, phone menu, visitor count |
| Writing | Add post, editor, uploads, autosaved drafts, edit, revisions and restore, scheduling, delete | to write | scheduling, revisions, drafts, uploads |
| Moderation | Post approval and rejection, all-posts view, comment moderation | to write | approval, rejection with reason, resubmission, moderator notifications, author deletes own post |
| Comments | Comment, reply threads, edit, delete, placeholders | to write | edit, delete, placeholders, reply notifications, permissions, limits, logged-out |
| Votes | Post, comment and author up/down votes, toggling, counters | to write | post, comment and profile votes: toggle, switch, counts, self-vote refused, logged-out |
| Publish requests | Reader requests author role, admin reviews, re-request after rejection | to write | request, pending after reload, approval, role upgrade |
| Notifications | Bell, notifications page, preferences, mark read, push, TTL | to write | most |
| Administration | Users and roles, categories, comment moderation, publish requests and applicant review, uploads report (download and delete unused files) | to write | categories CRUD, role change and access, comment search/paging/removal, admin-only access, applicant review, uploads report |
| Privacy and consent | Consent banner, visitor tracking, identity stitching | to write | accept, decline |
| Platform | CSP, gated routes, loading and not-found pages, theme, mobile layout, PWA manifest, health | to write | CSP, gates, manifest |
