# Vedev.Guru Blog — Feature Roadmap

## Context

The revamp in `docs/revamp-plan.md` covers the UI stack, editor, and core comment/voting/auth systems, all of which are in place. This doc scopes the next layer of work: closing gaps between "a working blog" and "a blog that's fully operable and discoverable in production."

Each section below describes the current gap and the proposed scope for closing it.

## 1. In-app notifications

**Current behavior.** Comments, replies, and votes are fully wired (`src/app/api/comments/`, `src/app/api/posts/[slug]/vote`, `src/app/api/users/[username]/vote`), but they're silent — a user has no way to learn that someone replied to their comment, voted on their post, or that a `Pending` post they authored was approved or rejected, short of revisiting the page themselves.

**Proposed scope.**
- A `Notification` model (recipient, type, source post/comment id, read state).
- Write a notification on: comment reply, post approval/rejection (the admin/moderator role that this depends on is already built).
- A notification bell in `Navbar.tsx` with an unread count and a dropdown list; polling or a lightweight unread-count endpoint rather than a websocket, to match this app's existing request/response architecture.
