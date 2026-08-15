---
title: "GraphQL vs REST: Choosing the Right API Architecture"
titleDescription: "Two different answers to 'how should client and server talk to each other'"
categorySlug: "technology"
tags: ["GraphQL", "REST", "API Design"]
bannerImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3"
summary: "Neither architecture is strictly better — they optimize for different problems, and picking the wrong one shows up months later, not on day one."
published: true
publishedAt: "2026-03-25"
approval: "Approved"
approvedAt: "2026-03-26"
visitorCount: 1490
---

REST and GraphQL both solve "how does a client get data from a server," but they start from opposite assumptions about who should decide the shape of a response. REST says the server defines fixed resources and the client takes what each endpoint gives it. GraphQL says the client describes exactly what it needs in a query, and the server figures out how to assemble that response. Both are reasonable positions — the right choice depends on what your actual client-server relationship looks like.

## The core difference, in code

A REST client fetching a post and its author makes decisions the server already baked in:

```
GET /posts/my-slug
```

```json
{
  "id": "1",
  "title": "My Post",
  "content": "...",
  "authorId": "42",
  "createdAt": "2026-03-01",
  "commentCount": 12
}
```

If the client only needed `title` and `commentCount`, it still gets everything — and if it also needs the author's name, that's a second request to `GET /users/42`, unless the API team anticipated this exact combination and built a special endpoint for it.

A GraphQL client asks for precisely what it wants, in one round trip:

```graphql
query PostWithAuthor($slug: String!) {
  post(slug: $slug) {
    title
    commentCount
    author {
      username
    }
  }
}
```

```json
{
  "data": {
    "post": {
      "title": "My Post",
      "commentCount": 12,
      "author": { "username": "sunil" }
    }
  }
}
```

No unused fields, no second request for the author — the resolver on the server handles fetching related data as part of the same query.

## Where each one wins

| | REST | GraphQL |
|---|---|---|
| Over/under-fetching | Common, unless you build many bespoke endpoints | Client controls the shape directly |
| Caching | Free with HTTP caching (URLs are cache keys) | Needs a dedicated client cache (Apollo, urql) — no natural URL-per-query |
| Learning curve | Familiar to anyone who's used HTTP | New query language, schema, resolver model |
| File uploads | Native (`multipart/form-data`) | Awkward — needs a spec extension or a separate REST endpoint |
| Versioning | `/v1`, `/v2`, or additive fields | Usually version-free — deprecate fields in the schema instead |
| Server complexity | Simple handlers per route | A schema, resolvers, and (usually) a dataloader to avoid N+1 queries |
| Best fit | Public APIs, simple CRUD, infra that already assumes REST (CDNs, API gateways) | Apps with many different clients (web/mobile/etc.) each needing different slices of the same data |

## The N+1 problem GraphQL introduces

GraphQL's flexibility has a real cost if you're not careful: a naive resolver for a list of posts, each resolving its own author, can turn one logical query into dozens of database round trips:

```
posts query → 1 query for 20 posts
author resolver × 20 → 20 separate queries for each post's author
```

The standard fix is a **dataloader** — a per-request cache that batches and deduplicates those lookups into a single `WHERE id IN (...)` query instead of twenty individual ones. This is the kind of thing REST doesn't force you to think about, because each endpoint's query pattern is usually written by hand, upfront, for exactly the data it returns.

## Caching is the underrated trade-off

REST's biggest, easiest-to-overlook advantage is that `GET /posts/my-slug` is a URL, and URLs are what HTTP caching, CDNs, and browsers already know how to cache for free. GraphQL typically sends every query as a `POST` to a single `/graphql` endpoint, so none of that infrastructure applies out of the box — you need a client-side normalized cache (Apollo Client, urql) to get comparable behavior, and it's solving a different problem: caching by query shape and object identity, not by URL.

## A practical way to decide

If you're building a public API that other teams or third parties will integrate against, REST's predictability and free HTTP caching usually win — nobody wants to learn a schema just to hit your API once. If you're building the backend for several different frontends (a web app, a mobile app, a dashboard) that each need overlapping-but-different slices of the same underlying data, GraphQL's client-driven queries avoid a proliferation of one-off REST endpoints built to serve each client's exact needs. Plenty of production systems use both — REST for simple public resources, GraphQL for the complex, multi-client internal graph — and that's a legitimate architecture, not a compromise.
