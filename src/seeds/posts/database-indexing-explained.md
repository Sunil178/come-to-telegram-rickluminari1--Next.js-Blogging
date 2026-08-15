---
title: "Database Indexing Explained: Why Your Queries Are Slow"
titleDescription: "What an index actually is, and how to know which fields need one"
categorySlug: "technology"
tags: ["Databases", "MongoDB", "Performance"]
bannerImage: "https://images.unsplash.com/photo-1591808216268-ce0b82787efe"
summary: "An index turns a query from 'scan everything' into 'jump straight to it' — but only if it matches how you're actually querying."
published: true
publishedAt: "2026-04-01"
approval: "Approved"
approvedAt: "2026-04-02"
visitorCount: 2010
---

A database without an index answers every query the same way: read every row (or document) and check if it matches. That's a **collection scan**, and it's fine at a thousand rows and a real problem at ten million. An index is a separate, sorted data structure the database maintains alongside your table, so it can find matching rows without looking at the ones that don't match at all.

## The book-index analogy, made precise

A book's index doesn't contain the book's content — it's a sorted list of terms, each pointing to the page it appears on. Looking up "mitochondria" doesn't mean reading every page; you jump straight to page 214. A database index works the same way: it stores the indexed field's values in sorted order, each paired with a pointer to the actual document. Most databases (MongoDB and PostgreSQL included) implement this as a **B-tree** — a balanced tree structure that keeps lookups, insertions, and range queries all efficient, even as the index grows to millions of entries.

## Seeing the difference directly

In MongoDB, `explain()` shows you exactly how a query was executed:

```js
db.posts.find({ slug: "database-indexing-explained" }).explain("executionStats");
```

Without an index on `slug`, the plan shows `COLLSCAN` — every document in the collection gets examined:

```json
{ "stage": "COLLSCAN", "nReturned": 1, "totalDocsExamined": 48213 }
```

After adding one:

```js
db.posts.createIndex({ slug: 1 });
```

The same query now shows `IXSCAN` — the index is walked directly to the matching entry, and only the one matching document is touched:

```json
{ "stage": "IXSCAN", "nReturned": 1, "totalDocsExamined": 1 }
```

That's the entire value proposition of indexing: `totalDocsExamined` drops from "the whole collection" to "exactly what matched."

## Indexes aren't free

Every index has to be updated on every write. A collection with five indexes doesn't just store the data five extra times — every `insert`, `update`, and `delete` now has to update five B-trees, not one. This is why indiscriminately indexing every field is a real anti-pattern, not just excessive caution: it trades write throughput for read speed you may not need on that particular field. The rule of thumb is to index the fields you actually filter, sort, or join on — not every field a document happens to have.

## Compound indexes and field order matters

A compound index on `{ userId: 1, createdAt: -1 }` is not the same as two separate single-field indexes — it's one sorted structure, sorted first by `userId`, then by `createdAt` within each `userId`. Field order determines what the index can efficiently serve:

```js
db.posts.createIndex({ userId: 1, createdAt: -1 });

// ✅ uses the index fully — filters userId, then walks createdAt already sorted
db.posts.find({ userId: "42" }).sort({ createdAt: -1 });

// ✅ still uses the index — userId is the index's leading field
db.posts.find({ userId: "42" });

// ❌ can't use this index efficiently — createdAt isn't the leading field
db.posts.find({ createdAt: { $gt: someDate } });
```

The general principle (sometimes called the **ESR rule** — Equality, Sort, Range) is: put fields you filter on with exact equality first, then fields you sort by, then fields you filter with a range (`$gt`, `$lt`) last.

## Unique indexes double as constraints

This codebase's own `Post` model uses exactly this pattern to prevent duplicate slugs at the database level, not just in application code:

```ts
schema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deleted: false } });
```

The `partialFilterExpression` matters here: it makes the uniqueness constraint apply only to non-deleted documents, so a soft-deleted post's old slug doesn't permanently block a new post from reusing it. A `unique: true` index without that qualifier would enforce uniqueness across every document ever created, including ones that are logically gone.

## When an index won't help

An index on `status` in a collection where 95% of rows have `status: "active"` barely helps a query for `status: "active"` — the database still has to read most of the collection either way, and for very low-selectivity fields like this, a full scan can actually be *cheaper* than the overhead of using the index. Indexes pay off most on fields with high **selectivity** — where a given value narrows the result set down to a small fraction of the total, like a `slug`, an `email`, or a `userId` in a table where most users have relatively few rows.

The practical habit worth building: before adding an index, ask what query it's for. An index nobody's query pattern actually uses is pure write-overhead with no read benefit — dead weight the database maintains forever, on your behalf, for nothing.
