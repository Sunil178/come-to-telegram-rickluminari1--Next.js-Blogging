---
title: "Designing RESTful APIs That Don't Make Developers Angry"
titleDescription: "Resource modeling, status codes, and versioning done properly"
categorySlug: "technology"
tags: ["API Design", "Backend", "REST"]
bannerImage: "https://images.unsplash.com/photo-1633265486064-086b219458ec"
summary: "REST is easy to half-follow and hard to follow well — here's what actually makes an API pleasant to consume."
published: true
publishedAt: "2026-03-18"
approval: "Approved"
approvedAt: "2026-03-19"
visitorCount: 1620
---

REST — Representational State Transfer — was formalized by Roy Fielding in his 2000 doctoral dissertation, as a description of the architectural style that made the web itself scale: resources identified by URLs, a small fixed set of methods, and stateless requests. Most "REST APIs" in the wild only loosely follow that, and that's usually fine — what actually matters day to day is a smaller, more practical set of conventions that make an API predictable to a developer who's never seen it before.

## Model resources, not actions

The most common mistake is designing endpoints around verbs instead of nouns:

```
❌ POST /createPost
❌ POST /getPostBySlug
❌ POST /deletePostById

✅ POST   /posts
✅ GET    /posts/:slug
✅ DELETE /posts/:slug
```

The HTTP method already carries the verb. `POST /posts` creates a post; `GET /posts/:slug` reads one; `PATCH /posts/:slug` updates one; `DELETE /posts/:slug` removes one. Once resources are nouns and methods are verbs, an API becomes guessable — a developer can predict `PATCH /posts/:slug/comments/:id` exists without ever reading a docs page, because it follows the same shape as everything else.

## Use status codes as information, not decoration

Status codes are part of the API's contract, not a formality. A client should be able to make a correct decision — retry, show an error, redirect to login — from the status code alone, before it even parses the body.

| Code | Meaning | When |
|---|---|---|
| `200 OK` | Success, with a body | GET, successful PATCH |
| `201 Created` | Success, a resource now exists | Successful POST |
| `204 No Content` | Success, nothing to return | Successful DELETE |
| `400 Bad Request` | The request itself is malformed | Missing/invalid fields |
| `401 Unauthorized` | No valid credentials | Not logged in |
| `403 Forbidden` | Valid credentials, insufficient permission | Logged in, not the owner |
| `404 Not Found` | Resource doesn't exist (or is hidden from this caller) | Wrong slug, or someone else's private post |
| `409 Conflict` | Request conflicts with current state | Duplicate slug |
| `422 Unprocessable Entity` | Well-formed request, semantically invalid | Passed validation shape but fails business rules |
| `500 Internal Server Error` | The server's fault, not the client's | Unhandled exception |

A subtle but important distinction: `401` means "I don't know who you are," `403` means "I know who you are, and the answer is no." Collapsing both into one status code forces the client to guess whether showing a login screen or an "access denied" message is the right response.

## Don't leak internals in error responses

```ts
// ❌ leaks the raw driver error, possibly including schema/query details
catch (err) {
  return Response.json({ error: err }, { status: 500 });
}

// ✅ generic message to the client, full detail to server-side logs
catch (err) {
  console.error("Failed to create post:", err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
```

A stack trace or raw database error in a JSON response is a debugging convenience for you and a reconnaissance tool for anyone probing your API. Log the detail server-side; return something a client can act on.

## Version deliberately, not accidentally

Once an API has real consumers, "just change the response shape" isn't free anymore — something out there is holding the old shape and will break. The common approaches:

- **URL versioning** (`/api/v1/posts`, `/api/v2/posts`) — the most explicit, easiest for clients to reason about, easiest to route differently server-side.
- **Header versioning** (`Accept: application/vnd.yourapi.v2+json`) — keeps URLs stable, but the version is easy to miss when someone's debugging with a browser or `curl` without extra flags.
- **No versioning, only additive changes** — new optional fields are fine; never remove or repurpose a field that existing clients might read. Works until it doesn't.

For most projects, URL versioning is the pragmatic default: it's visible, it's cacheable, and nobody has to dig through headers to know what they're calling.

## Pagination that doesn't fall over

`GET /posts` returning every row in the table works fine with 50 posts and becomes a production incident at 50,000. Cursor-based pagination scales better than offset-based (`?page=3`) because it doesn't re-scan skipped rows and doesn't shift results when new items are inserted mid-list:

```
GET /posts?limit=20&cursor=eyJfaWQiOiI2NmY... 

{
  "data": [ /* 20 posts */ ],
  "nextCursor": "eyJfaWQiOiI2NmY4...",
  "hasMore": true
}
```

> "Be conservative in what you send, be liberal in what you accept." — Jon Postel, RFC 761 (1980)

Postel's Law predates REST by two decades, but it's exactly the right instinct for API design: validate strictly on the way in (reject malformed requests clearly, rather than guessing at intent), and be forgiving about what optional fields a client happens to include on the way out. An API that's strict about its own contract and lenient about extra noise from callers tends to age a lot better than one that's the other way around.
