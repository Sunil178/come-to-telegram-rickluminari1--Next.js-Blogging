---
title: "Understanding CI/CD Pipelines"
titleDescription: "How automated testing and deployment actually fit together"
categorySlug: "technology"
tags: ["CI/CD", "DevOps", "Automation"]
bannerImage: "https://images.unsplash.com/photo-1573164713988-8665fc963095"
summary: "Continuous Integration and Continuous Deployment are two related but distinct habits — here's what each stage of a pipeline is actually for."
published: true
publishedAt: "2026-04-22"
approval: "Approved"
approvedAt: "2026-04-23"
visitorCount: 1340
---

CI/CD gets said as one phrase so often that the two halves blur together, but they answer different questions. **Continuous Integration** asks: does this change actually work, combined with everyone else's changes? **Continuous Deployment** (or the more cautious **Continuous Delivery**) asks: given that it works, how does it safely reach production? A pipeline is the automation that answers both, on every single change, instead of a human doing it by hand once a sprint.

## Why "integration" is the operative word

Before CI was standard practice, developers on a team could work in isolation for days or weeks before merging, and merging was often the worst part of the week — conflicting changes, incompatible assumptions, bugs that only appear when two people's work meets. Continuous Integration's actual proposal is simple: merge small changes frequently, and verify automatically, on every merge, that the combined result still works. The "continuous" part is what makes integration cheap instead of catastrophic — you find out your change conflicts with someone else's within minutes, not weeks later.

## A pipeline, stage by stage

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

Each step is a **gate** — if `lint` fails, `typecheck` never runs, and the pull request is blocked from merging. That ordering isn't arbitrary: cheap, fast checks (linting) run before expensive ones (a full build), so a trivial mistake fails in seconds instead of after a five-minute build has already run.

## What each stage is actually catching

| Stage | Catches |
|---|---|
| Lint | Style violations, obvious mistakes (unused variables, unreachable code) |
| Typecheck | Type mismatches the linter doesn't understand |
| Unit/integration tests | Logic errors, regressions in behavior |
| Build | Anything that only breaks when the whole app is assembled — missing exports, bad imports |
| End-to-end tests (if present) | Breakage in actual user flows, across multiple pages/services |

Running these in CI, on every pull request, means a broken build is a five-minute problem discovered before merge — not a "why is production down" problem discovered after.

## Continuous Delivery vs. Continuous Deployment

Both start the same way — an automated pipeline that builds, tests, and packages a release candidate — but they end differently:

- **Continuous Delivery**: every change that passes the pipeline is *ready* to deploy, but a human still clicks the button. The safety net is automated; the final decision isn't.
- **Continuous Deployment**: every change that passes the pipeline deploys automatically, with no human gate at all. This only works if the pipeline's test coverage is trustworthy enough that "passed CI" and "safe for production" are actually the same statement.

Most teams land on Continuous Delivery in practice — automated up to a manual "deploy" click — because full Continuous Deployment demands a level of test confidence (and often feature flags, to decouple deploying code from releasing a feature) that takes real investment to earn.

## Deployment strategies that limit blast radius

Shipping straight to 100% of production traffic means a bad release is a full outage the moment it lands. A few common alternatives:

- **Rolling deployment** — replace old instances with new ones a few at a time, so the app never has zero capacity, and a bad release only affects instances that have already been swapped.
- **Blue-green deployment** — run two full environments; switch traffic from the old ("blue") to the new ("green") all at once, keeping the old one warm as an instant rollback target.
- **Canary deployment** — send a small percentage of real traffic (5%, say) to the new version first, watch error rates and latency, and only widen the rollout if the metrics look healthy.

## What CI/CD doesn't fix by itself

Pipelines don't create test coverage — they run whatever tests you've written, and a pipeline full of green checkmarks against a thin test suite is confidence you haven't actually earned. The pipeline's job is to make sure whatever quality bar you've defined actually gets enforced, consistently, on every change, without relying on someone remembering to run it by hand. It's automation for discipline you already have, not a substitute for having it.
