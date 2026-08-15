---
title: "Microservices vs. Monoliths: Architectural Trade-offs"
titleDescription: "Neither is the default correct answer — the trade-off is operational complexity for independent scaling"
categorySlug: "technology"
tags: ["Architecture", "Microservices", "Backend"]
bannerImage: "https://images.unsplash.com/photo-1531297484001-80022131f5a1"
summary: "Microservices solve real problems monoliths have at scale — and introduce real problems monoliths never had at all."
published: true
publishedAt: "2026-06-10"
approval: "Approved"
approvedAt: "2026-06-11"
visitorCount: 1730
---

A monolith is a single deployable application — one codebase, one build, one process (or a small number of identical replicas of that one process) handling every responsibility: auth, posts, comments, notifications, all of it. Microservices split that same functionality into independently deployable services, each owning its own piece, communicating over the network instead of through in-process function calls. Both are legitimate architectures. The mistake is treating one as automatically more "modern" or "correct" than the other, rather than as a trade-off with real costs on both sides.

## What a monolith actually gives you

```
┌─────────────────────────────────┐
│           Application            │
│  ┌──────┐ ┌──────┐ ┌──────────┐ │
│  │ Auth │ │Posts │ │ Comments │ │
│  └──────┘ └──────┘ └──────────┘ │
│         one process, one DB      │
└─────────────────────────────────┘
```

A function call between the "posts" and "comments" logic is just a function call — no network hop, no serialization, no partial-failure handling. A single transaction can span multiple domains atomically, because it's one database connection, one transaction. Deploying is one build, one artifact, one thing to roll back if something goes wrong. This is a genuinely simpler system to build, reason about, test, and debug — and for a huge number of applications, simple is correct, not merely "good enough for now."

## What starts to hurt as a monolith grows

The trouble isn't the architecture failing outright — it's a slow accumulation of friction. Every team touching the codebase shares one build and one deploy pipeline, so an unrelated team's broken change can block your release. Scaling means scaling the *entire* application, even if only one part (say, image processing) is actually under load — you can't scale just the hot path in isolation. And as the codebase grows, module boundaries that were never enforced by anything stronger than convention tend to erode; "just import that internal function directly, it's right there" is how a monolith's internal structure quietly turns into a tangle no one fully understands anymore.

## What microservices actually buy you

```
┌────────┐   ┌────────┐   ┌──────────┐
│  Auth  │   │ Posts  │   │ Comments │
│Service │   │Service │   │ Service  │
│ own DB │   │ own DB │   │  own DB  │
└────────┘   └────────┘   └──────────┘
     ↑            ↑             ↑
     └──── network calls (HTTP/gRPC) ────┘
```

Each service can be deployed independently — shipping a comments-service fix doesn't require redeploying auth. Each can scale independently — if comments get ten times the traffic of everything else, only the comments service needs more replicas. Each can, in principle, be owned by a different team with a genuinely enforced boundary, because the only way to talk to another service is over the network, through its actual API — there's no "just import the internal function," because there's no shared process to import from.

> "You build it, you run it." — Werner Vogels, Amazon CTO, on the operational model microservices enable: teams that own a service end-to-end, including running it in production.

## The costs that don't show up until you're operating it

A function call becomes a network call, and network calls fail in ways function calls don't — timeouts, partial failures, a service being temporarily unreachable while its dependents keep running. A transaction that used to be atomic across two domains now has to be handled with patterns like the **Saga pattern** (a sequence of local transactions with compensating actions if a later step fails), because there's no single database transaction spanning two services anymore. Observability — knowing what actually happened for a single user request — now means tracing that request across multiple services, which is why distributed tracing (OpenTelemetry and similar) becomes close to mandatory rather than a nice-to-have. And the sheer number of moving parts — multiple deployments, multiple databases, service discovery, inter-service auth — is genuine operational overhead that a small team can spend more time managing than actually building product with.

## A practical way to decide

| Signal | Leans toward |
|---|---|
| Small team, one shared understanding of the whole system | Monolith |
| Different parts have wildly different scaling needs | Microservices |
| Need independent deploys for genuinely independent teams | Microservices |
| Early-stage product, domain boundaries still shifting | Monolith |
| Strong need for fault isolation (one part failing shouldn't take down everything) | Microservices |

The pattern many mature engineering orgs actually follow is starting with a well-structured monolith — internal module boundaries enforced by discipline and code review, even without network boundaries — and extracting a piece into its own service only once there's a concrete, specific reason (a real scaling bottleneck, a real team-ownership need), rather than adopting microservices upfront on the assumption that it's what "properly architected" systems do. A monolith with clean internal boundaries is a much better starting point for an eventual extraction than a system that went straight to distributed complexity before anyone had a clear picture of where the real boundaries belonged.
