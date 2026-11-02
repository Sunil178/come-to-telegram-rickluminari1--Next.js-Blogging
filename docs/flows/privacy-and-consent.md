# Privacy and consent

**Who:** every visitor. **Entry points:** the consent banner on a first visit, "Cookie preferences" in the footer, "Privacy" in the footer (`/privacy`).

## How it works

Reading history is recorded only with consent (decision D-07). The banner (`src/components/consent/ConsentBanner.tsx`) stores the choice in the `consent` cookie. On "Accept", the browser gets a random visitor id in the `vid` cookie, and each post read is recorded as a visitor event (`src/libs/visitor-events.ts`, `src/models/VisitorEvent.ts`, kept 180 days); signing in or registering attaches that history to the account (`stitchVisitor`). `consentedVisitorId()` in `src/libs/visitor.ts` returns an id only when consent was given and the cookie holds an id the site issued. The history appears in the account's data export.

## Flows

### 1. Accept

1. A first-time visitor sees the banner and chooses "Accept". → The banner closes; a `vid` cookie is set.
2. Reads posts, then signs in. → The reads are recorded and become part of the account's history (visible in the data export).

**Tested by:** `e2e/consent.spec.ts` › "accepting consent records reads and stitches them to the account at sign-in".

### 2. Decline, and change one's mind

1. Chooses "Decline". → The banner closes; no `vid` cookie, and reads aren't recorded.
2. Later chooses "Cookie preferences" in the footer. → The banner reopens and the choice can be changed either way.

**Extensions:**

- 2a. Withdrawing consent after accepting: the `vid` cookie is removed and this browser's anonymous history is deleted; reads already attached to an account stay with the account (they go with its export and deletion).

**Tested by:** `e2e/consent.spec.ts` › "declining sets no visitor cookie and records nothing, and the choice can be changed later".

## Rules and limits

- Cookies: the session cookie (essential, up to 30 days), `consent` (essential, 1 year), `vid` (only with consent, 1 year), `viewed:…` (essential, 30 minutes, stops a visit counting twice).
- Visitor events expire after 180 days through a TTL index.
- What else is stored, and for how long, is described on `/privacy` (see [account-self-service.md](account-self-service.md)).
