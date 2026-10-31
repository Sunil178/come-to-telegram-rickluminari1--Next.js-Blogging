# Vedev.Guru Blog — Feature Roadmap

## Context

The revamp in `docs/revamp-plan.md` covers the UI stack, editor, and core comment/voting/auth systems, all of which are in place. This doc scopes the next layer of work: closing gaps between "a working blog" and "a blog that's fully operable and discoverable in production."

All items previously scoped here (SEO/production plumbing, real page-view tracking, in-app notifications) have shipped. In-app notifications are backed by a `Notification` model plus real Web Push (`src/libs/notify.ts`, `src/models/PushSubscription.ts`, `public/sw.js`) rather than polling — a push event updates the navbar bell live in an open tab and can deliver an OS-level notification when none is open; the bell also fetches once on mount as a correctness fallback for browsers or permission states where push isn't available.
