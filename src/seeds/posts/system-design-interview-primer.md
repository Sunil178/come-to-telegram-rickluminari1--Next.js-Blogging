---
title: "A System Design Interview Primer"
titleDescription: "A repeatable framework for the 'design X at scale' question"
categorySlug: "technology"
tags: ["System Design", "Interviews", "Architecture"]
bannerImage: "https://images.unsplash.com/photo-1591453089816-0fbb971b454c"
summary: "System design interviews reward a structured approach more than encyclopedic knowledge — here's a framework that works across almost any prompt."
published: true
publishedAt: "2026-07-29"
approval: "Approved"
approvedAt: "2026-07-30"
visitorCount: 2350
---

"Design a URL shortener" or "design a news feed" are deliberately open-ended prompts — there's no single correct architecture, and the interview isn't actually testing whether you land on one specific design. It's testing whether you can navigate ambiguity methodically: clarify what's actually being asked, reason explicitly about trade-offs, and justify decisions with numbers rather than intuition alone. A repeatable framework matters more here than memorizing any particular system's architecture, because the framework is what transfers to a prompt you've never specifically prepared for.

## Step 1: Clarify requirements before designing anything

Jumping straight to boxes and arrows on a whiteboard, before establishing what the system actually needs to do, is the most common mistake. Separate functional from non-functional requirements explicitly:

- **Functional**: What must the system do? (For a URL shortener: create a short URL, redirect it to the original, maybe track click counts.)
- **Non-functional**: How well must it do it? (Expected scale — reads vs. writes per second — latency targets, availability requirements, consistency needs.)

> "Everything fails, all the time." — Werner Vogels, Amazon CTO

Vogels's line is usually invoked for a reason in this step specifically: at real scale, hardware fails, networks partition, and instances get killed constantly — designing as though failure is the exception rather than the constant is how systems that looked fine in a design review fall over in production.

## Step 2: Estimate scale with real numbers

Rough back-of-envelope math anchors every later decision — it's the difference between "we'll need caching, probably" and a design that can actually justify itself:

```
Assume: 100M daily active users, each creates ~2 short URLs
Writes/day: 200M → ~2,300 writes/sec average
Assume a 100:1 read-to-write ratio (shortened URLs get clicked way more than created)
Reads/day: 20B → ~230,000 reads/sec average

Storage: 200M URLs/day × 365 days × 5 years × ~500 bytes/record ≈ 180 TB
```

These numbers directly drive real decisions later: 230,000 reads/sec means the redirect path needs aggressive caching (most of those reads should never reach the database); 2,300 writes/sec is comfortably within a single well-indexed database's write capacity, so the write path likely doesn't need to be over-engineered from day one.

## Step 3: High-level design, then go deeper

Start with the major components and how data flows between them, before drilling into any one piece:

```
Client → Load Balancer → App Servers → Cache (check first)
                                            ↓ (cache miss)
                                        Database
```

For a URL shortener specifically: the write path (generate a unique short code, store the mapping) and the read path (look up a short code, redirect) have very different performance requirements — reads dominate by orders of magnitude, so that's where caching and read-replica effort should concentrate first, not on the comparatively rare write path.

## Step 4: Talk through the trade-offs explicitly, not just the choice

This is the step that actually separates a strong answer from a mediocre one — not which technology you picked, but whether you can articulate what you gave up to get it.

| Decision point | Option A | Option B | The actual trade-off |
|---|---|---|---|
| Database | SQL (Postgres) | NoSQL (a document store) | Strong relational integrity + transactions vs. flexible schema + easier horizontal scaling |
| Consistency | Strong | Eventual | Every read sees the latest write vs. higher availability during network partitions |
| Short code generation | Random + collision check | Counter-based (base62 encoding of an incrementing ID) | No coordination needed vs. guaranteed uniqueness without a collision-check round trip |
| Caching | Cache-aside (app checks cache, falls back to DB) | Write-through (every write also updates the cache) | Simpler, cache can go briefly stale vs. cache always fresh, extra write latency |

None of these has a universally correct answer — a strong candidate picks one, states the reasoning, and explicitly names what the other option would have been better at. That's the actual skill being evaluated.

## Step 5: Identify the bottleneck and address it specifically

Every design has exactly one component that will break first under load — a single database instance, a service with no horizontal scaling path, a cache that isn't actually reducing database load because of a bad key strategy. Naming it explicitly ("the single Postgres instance is the bottleneck past roughly 5,000 writes/sec — here's how I'd shard it") demonstrates the kind of judgment interviewers are actually screening for, far more than reciting that "we'd add a cache" without connecting it to a specific, quantified pressure point in *this* design.

## The meta-skill under all of it

System design interviews reward **structured reasoning under ambiguity** more than any specific fact. A candidate who clarifies scope, does rough math, proposes a design, and reasons explicitly about trade-offs — even landing on an imperfect final architecture — reads as stronger than one who confidently draws an elaborate, over-engineered system for a scale nobody actually asked for. The framework itself (clarify, estimate, design broad-to-narrow, discuss trade-offs, find the bottleneck) is the transferable skill; the specific system in the prompt is almost incidental.
