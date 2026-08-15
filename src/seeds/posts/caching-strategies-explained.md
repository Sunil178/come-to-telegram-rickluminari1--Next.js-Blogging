---
title: "Understanding Caching: Browser, CDN, and Redis"
titleDescription: "Three layers of caching that solve related but distinct problems"
categorySlug: "technology"
tags: ["Caching", "Performance", "Redis"]
bannerImage: "https://images.unsplash.com/photo-1504384308090-c894fdcc538d"
summary: "Every caching layer trades staleness risk for speed — the skill is choosing how much staleness each specific piece of data can tolerate."
published: true
publishedAt: "2026-07-22"
approval: "Approved"
approvedAt: "2026-07-23"
visitorCount: 1720
---

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

The joke lands because it's true: caching is conceptually trivial (store a copy of something expensive to compute, so you don't recompute it every time) and practically hard, because the store copy can go stale, and knowing exactly when to throw it away is where most caching bugs actually live. Different layers of a web app cache for different reasons, at different distances from the user, and understanding each one separately makes the trade-offs much clearer than treating "caching" as one undifferentiated thing.

## Browser caching: closest to the user, zero network cost when it hits

The browser can store a response locally and skip the network entirely on a repeat request, governed by HTTP headers the server sends:

```
Cache-Control: public, max-age=31536000, immutable
```

This tells the browser: cache this for a year, don't even bother re-checking with the server. It's exactly right for content that's fingerprinted by filename — a built JS bundle like `app.a3f9c2.js` — because a content change produces a *new* filename, so the old cached file being stale is a non-issue; it'll simply never be requested again once the app deploys a new one.

```
Cache-Control: no-cache
```

This is a commonly misread header — `no-cache` does *not* mean "don't cache." It means "cache it, but revalidate with the server before using the cached copy" (typically via an `ETag` and a cheap `304 Not Modified` response if nothing changed). `no-store` is the header that actually means "don't cache this at all," which matters for anything containing sensitive, per-user data.

## CDN caching: closest to the user, but shared across users

A Content Delivery Network caches responses at edge locations distributed globally, so a user in Singapore gets a cached response from a nearby edge node instead of a round trip to your origin server on another continent. The critical difference from browser caching: a CDN cache is **shared** across every user hitting that edge location, so it's only appropriate for content that's the same for everyone — a blog post's rendered HTML, a public image, a JS bundle — never for anything personalized (a user's own dashboard, an authenticated API response), unless the cache key explicitly accounts for exactly who's asking.

```
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

`stale-while-revalidate` is a particularly useful pattern: for 60 seconds, serve straight from cache; for the next 300 seconds after that, still serve the (now stale) cached copy immediately, while fetching a fresh one in the background to update the cache for the *next* request. Users essentially never wait on a cache miss — they get an instant, slightly-stale response while freshness catches up behind the scenes.

## Redis / application-level caching: closest to your database

This layer sits inside your own infrastructure, caching the results of expensive operations — a database query, an external API call, a computed aggregate — so repeated requests for the same thing don't repeat the expensive work:

```ts
async function getPostBySlug(slug: string) {
  const cached = await redis.get(`post:${slug}`);
  if (cached) return JSON.parse(cached);

  const post = await Post.findOne({ slug }).lean();
  await redis.set(`post:${slug}`, JSON.stringify(post), "EX", 300); // 5-minute TTL
  return post;
}
```

The `EX 300` sets a **time-to-live** — after 5 minutes, Redis expires the entry automatically, and the next request repopulates it. TTL-based expiry is the simplest invalidation strategy, and it's the right one whenever a little staleness (up to the TTL window) is genuinely acceptable.

## Active invalidation: when staleness isn't acceptable

TTL alone isn't enough when a write needs its effect visible immediately — a user edits their own post and expects to see the change on refresh, not up to five minutes later. The fix is to explicitly clear (or update) the cache entry at the moment of the write, not just wait for it to expire:

```ts
async function updatePost(slug: string, updates: Partial<Post>) {
  const post = await Post.findOneAndUpdate({ slug }, updates, { new: true });
  await redis.del(`post:${slug}`); // invalidate immediately — don't wait for TTL
  return post;
}
```

## A layered summary

| Layer | Distance from user | Shared or per-user | Typical TTL |
|---|---|---|---|
| Browser cache | Zero (local disk) | Per-user | Minutes to a year, content-dependent |
| CDN | Nearby edge location | Shared across users | Seconds to hours |
| Redis / app cache | Your own infrastructure | Shared across users | Seconds to minutes |
| Database | Origin of truth | — | Not cached — this is the source |

Each layer exists because it's progressively cheaper (and faster) than the layer beneath it — but progressively riskier to serve stale, since it's progressively further from the actual source of truth. The design question for any given piece of data isn't "should this be cached," it's "how stale can this specific thing be before that staleness actually matters to someone" — and that answer is different for a JS bundle, a blog post, and a bank balance, which is exactly why one caching strategy for an entire app is usually the wrong instinct.
