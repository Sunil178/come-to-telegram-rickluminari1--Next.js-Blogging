# <Group name>

**Who:** the roles that use it. **Entry points:** the pages, links, emails and notifications that lead here.

## How it works

Two to five sentences on the core logic, with links to the main files (pages, API routes, models, libraries).

## Flows

### 1. <Flow name>

**Preconditions:** the starting state (role, data that must exist).

1. What the user does. → What they see.
2. …

**Extensions:**

- 2a. <Alternate or error condition>: what happens instead.

**Side effects:** emails, notifications, push messages, data written, counters changed.

**Tested by:** `e2e/<file>.spec.ts` › "<test name>" (or "not automated yet").

## Rules and limits

Validation rules, rate limits, permissions per role, time-to-live values, each with its number.
