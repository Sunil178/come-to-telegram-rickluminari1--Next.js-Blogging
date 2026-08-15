# Vedev.Guru Blog — Feature Roadmap

## Context

The revamp in `docs/revamp-plan.md` covers the UI stack, editor, and core comment/voting/auth systems, all of which are in place. This doc scopes the next layer of work: closing gaps between "a working blog" and "a blog that's fully operable and discoverable in production."

Each section below describes the current gap and the proposed scope for closing it. Sequencing is at the end.

## 1. SEO and production plumbing

**Current behavior.** `layout.tsx`'s `metadata` export has no `metadataBase`, so Open Graph/Twitter image URLs resolve against `http://localhost:5000` in every environment (visible as a console warning on every page load). There is no `sitemap.ts`, `robots.ts`, or RSS feed. Individual posts have no per-post Open Graph image — social shares fall back to whatever default metadata the root layout provides.

**Proposed scope.**
- Set `metadataBase` in `src/app/layout.tsx`, sourced from an env var so it's correct per environment.
- Add `src/app/sitemap.ts` (dynamic, listing published+approved posts) and `src/app/robots.ts`, both native Next.js App Router conventions — no new dependency.
- Add `generateMetadata` to `src/app/posts/[slug]/page.tsx` for per-post title/description/OG image, using the post's `bannerImage` and `summary`.
- Add an RSS feed route (e.g. `src/app/feed.xml/route.ts`) listing recent published posts.

## 2. Real page-view tracking

**Current behavior.** `Post.visitorCount` is a real schema field, displayed in both the public post view and `/dashboard/posts`, but nothing increments it — every value currently on record is whatever the seed script wrote. It reads as a live stat but isn't one.

**Proposed scope.**
- Increment `visitorCount` from `src/app/posts/[slug]/page.tsx` on render, deduped per visitor (e.g. a short-lived cookie or IP+slug key) so refreshes and the author's own repeat visits don't inflate the count.
- Keep the increment fire-and-forget (non-blocking) so it can't add latency to the page render.

## 3. In-app notifications

**Current behavior.** Comments, replies, and votes are fully wired (`src/app/api/comments/`, `src/app/api/posts/[slug]/vote`, `src/app/api/users/[username]/vote`), but they're silent — a user has no way to learn that someone replied to their comment, voted on their post, or that a `Pending` post they authored was approved or rejected, short of revisiting the page themselves.

**Proposed scope.**
- A `Notification` model (recipient, type, source post/comment id, read state).
- Write a notification on: comment reply, post approval/rejection (the admin/moderator role that this depends on is already built).
- A notification bell in `Navbar.tsx` with an unread count and a dropdown list; polling or a lightweight unread-count endpoint rather than a websocket, to match this app's existing request/response architecture.

## Sequencing

1. **SEO/production plumbing** — low-risk, convention-based, and directly serves shipping this blog publicly.
2. **Real view tracking** and **notifications** as follow-up phases, each small enough to scope on its own once the above land.
