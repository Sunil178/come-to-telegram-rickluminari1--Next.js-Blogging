# User flows

One document per flow group describes how a feature works from the user's side and where its logic lives, for a newcomer, an AI agent or a support bot. Each document doubles as the QA plan for its group, and each scenario names the Playwright test that proves it, so the documents stay true: when behaviour changes, the test fails until the document and the test are updated together. `src/flow-docs.test.ts` (part of `npm test`) fails when a document cites a test that doesn't exist, an e2e test isn't cited anywhere, or a linked or named file is missing.

The format follows the flow document standard in [docs/kits/flow-qa/flow-doc-standard.md](../kits/flow-qa/flow-doc-standard.md) (use cases, living documentation, Diátaxis) and its template; the QA method is [docs/kits/flow-qa/method.md](../kits/flow-qa/method.md), run here as described in [docs/procedures/qa-testing.md](../procedures/qa-testing.md).

| Group | Covers | Flow doc |
|---|---|---|
| Accounts | Register and verify, sign in and out, forgot and reset password, lockout, session revocation | [accounts.md](accounts.md) |
| Account self-service | Profile and photo, change password, data export, account deletion, privacy page | [account-self-service.md](account-self-service.md) |
| Reading | Posts list (categories, search, pages), post page, related posts, visitor count, author profile, RSS, sitemap, robots | [reading.md](reading.md) |
| Writing | Editor, image uploads, autosaved drafts, scheduling, edit, revisions and restore, delete | [writing.md](writing.md) |
| Moderation | Post approval, rejection with a reason, resubmission, comment moderation | [moderation.md](moderation.md) |
| Comments | Comment, reply, edit, delete, placeholders, limits | [comments.md](comments.md) |
| Votes | Post, comment and profile votes, toggling, counts, logged out | [votes.md](votes.md) |
| Publish requests | Application, admin review with addresses and profile, approval, decline and re-apply | [publish-requests.md](publish-requests.md) |
| Notifications | Bell, notifications page, preferences, push, staff notifications, expiry | [notifications.md](notifications.md) |
| Administration | Users, their details and roles, contact messages, categories, uploads report, admin-only access | [administration.md](administration.md) |
| Privacy and consent | Consent banner, reading history, identity stitching, withdrawal, policies, contact form and reports | [privacy-and-consent.md](privacy-and-consent.md) |
| Platform | Gated routes, CSP, loading and not-found states, theme, phone layout, manifest, health | [platform.md](platform.md) |
