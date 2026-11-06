# Privacy and consent

**Who:** every visitor. **Entry points:** the consent banner on a first visit, "Cookie preferences" in the footer, "About", "Contact", "Terms" and "Privacy" in the footer (`/about`, `/contact`, `/terms`, `/privacy`).

## How it works

Reading history is recorded only with consent. The banner (`src/components/consent/ConsentBanner.tsx`) stores the choice in the `consent` cookie. On "Accept", the browser gets a random visitor id in the `vid` cookie, and each post read is recorded as a visitor event (`src/libs/visitor-events.ts`, `src/models/VisitorEvent.ts`, kept 180 days); signing in or registering attaches that history to the account (`stitchVisitor`). `consentedVisitorId()` in `src/libs/visitor.ts` returns an id only when consent was given and the cookie holds an id the site issued. The history appears in the account's data export.

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

### 3. Read the site's policies

1. Follows "About", "Contact", "Terms" or "Privacy" in the footer. → The page opens; all four are in the sitemap.

**Extensions:**

- 1a. `OPERATOR_NAME`, `OPERATOR_LOCATION` or `CONTACT_EMAIL` unset: the pages say "the site's operator" or "the site administrator" instead, and Contact says the address isn't set up yet.

**Side effects:** none.

**Tested by:** `e2e/legal-and-private.spec.ts` › "the footer links to the About, Contact, Terms and Privacy pages".

## Rules and limits

- The policies are written for India: the privacy page follows the DPDP Act 2023 (data fiduciary, purposes, children under 18, rights including nomination, the Data Protection Board), the terms list the content the IT Rules 2021 prohibit and require labelled AI-generated media, and Contact names the grievance officer with the response times (acknowledge within 24 hours, resolve within 15 days, intimate images within 24 hours). Their text and contacts come from `OPERATOR_NAME`, `OPERATOR_LOCATION` and `CONTACT_EMAIL` (`siteOperator()` in `src/libs/runtime-config.ts`).

- Cookies: the session cookie (essential, up to 30 days), `consent` (essential, 1 year), `vid` (only with consent, 1 year), `viewed:…` (essential, 30 minutes, stops a visit counting twice).
- Visitor events expire after 180 days through a TTL index.
- What else is stored, and for how long, is described on `/privacy` (see [account-self-service.md](account-self-service.md)).
