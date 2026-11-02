# QA testing: <project>

How this project runs the QA method in `docs/kits/flow-qa/method.md`. The flow inventory is `docs/flows/README.md`; the current QA pass is `docs/qa/<pass>.md`.

## Isolated environment

- **Server:** how to build and start a production server on a dedicated port (never a developer's port), and how to stop it.
- **Database:** the throwaway database name and how it's seeded (and reset).
- **Email:** the local mail catcher, how to start it and where its inbox is.
- **Other services:** anything else a flow needs (object storage, payment sandbox, geolocation data) and how it's provided in tests.

## Test data and roles

| Role | Account | Notes |
|---|---|---|
| <role> | <email or how to create one> | <what it can do> |

Helpers for creating extra users and records inside tests: <file and function names>.

## Commands

| Command | Purpose |
|---|---|
| <unit tests> | |
| <end-to-end tests, one browser> | |
| <end-to-end tests, every browser> | |

## Browsers and devices

Which browsers and viewports the project supports, and which ones a QA session uses by default.

## Project rules

Anything the method should respect here: rate limits that repeated test runs will hit, data that must never be touched, budget limits for agent sessions.
