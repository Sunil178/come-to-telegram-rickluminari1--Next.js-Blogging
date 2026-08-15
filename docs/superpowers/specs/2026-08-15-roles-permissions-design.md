# Roles & Permissions — Design

## Context

The app currently has no role concept: every authenticated user has identical capabilities (create/edit/delete their own posts, comment, vote), scoped entirely by ownership. `Post.approval` (`Pending`/`Approved`/`Rejected`/`Inactive`) is a real field, but nothing outside a post's own author can see or act on it, so a `Pending` post has no reviewer. Category management has no UI at all — categories only exist via `src/seeds/categories.json`.

This spec introduces a four-tier role system and the admin surfaces it unlocks: a cross-user post review queue, comment moderation, publish-request approval, user role management, and category management.

## Roles

Ranked lowest to highest; each role has every capability of the roles below it.

| Rank | Role | Summary |
|---|---|---|
| 0 | **Reader** | Default role for every new registration. Browses, comments, votes. Cannot create posts. |
| 1 | **Author** | Creates and manages their own posts (today's behavior for every logged-in user, now scoped to this tier). |
| 2 | **Moderator** | Reviews the cross-user Pending queue (approve/reject any post) and moderates comments (remove any comment). Cannot edit another user's post content, manage roles, or manage categories. |
| 3 | **Admin** | Manages user roles (including granting Moderator/Admin), reviews publish requests, manages categories, and has override access to edit/delete any post or comment regardless of owner. |

Reading published posts stays fully public and unauthenticated — the role system governs everything past that (comment, vote, create, moderate, administer).

## Permission matrix

| Capability | Reader | Author | Moderator | Admin |
|---|:---:|:---:|:---:|:---:|
| Read published posts | ✓ (public) | ✓ | ✓ | ✓ |
| Comment, reply, vote on posts/comments/profiles | ✓ | ✓ | ✓ | ✓ |
| Submit a publish request | ✓ | — | — | — |
| Create a post (enters as Pending) | — | ✓ | ✓ | ✓ |
| Edit/delete own posts | — | ✓ | ✓ | ✓ |
| View "My Posts" dashboard | — | ✓ | ✓ | ✓ |
| Cross-user Pending queue; approve/reject any post | — | — | ✓ | ✓ |
| Moderate comments (remove any comment) | — | — | ✓ | ✓ |
| Review/approve publish requests | — | — | — | ✓ |
| Manage user roles | — | — | — | ✓ |
| Manage categories | — | — | — | ✓ |
| Edit or hard-delete any post regardless of owner | — | — | — | ✓ |

## Data model

**`User.role`** (`src/models/User.ts`): new field, `"reader" | "author" | "moderator" | "admin"`, schema default `"reader"`. A shared `ROLE_RANK` map and `hasRole(role, minimum)` helper live in a new `src/libs/roles.ts` (plain functions, no Node-only APIs — needed in both the edge-run `proxy.ts` and server-run `api-guard.ts`).

**`PublishRequest`** (new model, `src/models/PublishRequest.ts`): a Reader's request to become an Author.
```
userId: ObjectId (ref User, required)
status: "Pending" | "Approved" | "Rejected" (default "Pending")
reviewedBy: ObjectId (ref User, optional)
reviewedAt: Date (optional)
timestamps: true
```
A user may have at most one `Pending` request at a time (checked in the create route, not a DB constraint — consistent with how this codebase handles similar one-at-a-time invariants elsewhere). Approving a request sets the requester's `User.role` to `"author"` in the same transaction as marking the request `Approved`.

## Session and enforcement

`role` is added to the NextAuth JWT/session, following the existing `username` augmentation exactly: `src/types/next-auth.d.ts` gains `role` on `Session.user`, `User`, and `JWT`; the `jwt`/`session` callbacks in `src/app/api/auth/[...nextauth]/auth.ts` copy it through.

**Known limitation:** because role lives in the JWT, a role change (e.g. promoting a Reader to Author) takes effect the next time that user's session is issued — next sign-in, not mid-session. This is a standard, accepted tradeoff for JWT-based sessions and isn't solved here; if it becomes a real problem later, the fix is a shorter JWT `maxAge` or a session-refresh trigger, not a v1 concern.

Two enforcement points, matching the two that already exist in this codebase:

- **`proxy.ts`** — edge-checkable, role-only gates (no per-resource DB lookup needed): `/posts/add` requires Author+, `/dashboard/admin/posts` and `/dashboard/admin/comments` require Moderator+, `/dashboard/admin/users`, `/dashboard/admin/categories`, and `/dashboard/admin/requests` require Admin. `/posts/:slug/edit` stays auth-only at the edge, same as today — ownership vs. Admin-override can't be resolved without a DB read.
- **`src/libs/api-guard.ts`** — `withApiGuard` gains a `role?: RoleName` option (implies `auth`), rejecting with 403 when `session.user.role` ranks below it. Used by pure role-gated routes: post-approval, comment moderation, publish-request review, user role management, category CRUD.
- **Ownership-or-Admin-override** (editing/deleting *someone else's* post or comment) isn't a single minimum-role check, so it stays as explicit logic inside the route handler, the same way ownership is inlined into the query filter today (`{ slug, userId: session.user.id }` becomes `{ slug, ...(isAdmin ? {} : { userId: session.user.id }) }`).

## Routes and pages

New, under `/dashboard/admin/`:
- `posts` (Moderator+) — cross-user Pending queue; approve/reject.
- `comments` (Moderator+) — comment moderation list; remove any comment.
- `requests` (Admin) — publish-request queue; approve/reject.
- `users` (Admin) — user list with role assignment.
- `categories` (Admin) — category CRUD (none exists today).

New API routes: `POST /api/publish-requests` (Reader submits), `PATCH /api/publish-requests/[id]` (Admin approves/rejects), `PATCH /api/users/[id]/role` (Admin sets role), `POST`/`PATCH`/`DELETE /api/categories[/[id]]` (Admin).

Extended existing routes: `PATCH /api/posts/[slug]` gains a Moderator+-only approval-status update path (or a dedicated `PATCH /api/posts/[slug]/approval` — implementation plan decides which fits the existing route shape better); `DELETE /api/comments/[id]` and the post edit/delete routes gain the ownership-or-Admin-override branch described above.

A "Request to publish" action is added to the existing `/dashboard` page, visible only to Readers.

**Out of scope, pre-existing:** `GET /api/posts` (`src/app/api/posts/route.ts`) is dead legacy code with zero callers — a leftover from before the dashboard rebuild. It's unrelated to this feature and isn't touched or built upon here.

## Rollout

`User.role` defaults to `"reader"` for every new registration going forward. Existing accounts need a one-time backfill, since a schema default doesn't retroactively apply to existing documents:
- `src/seeds/seeder.ts`'s `seedDemoUsers()` is extended to set an explicit `role` per demo user (`$set` on both create and already-exists paths, so re-running the seeder reliably backfills it) — covering all four tiers among the demo accounts so admin/moderator flows are testable without touching a real account.
- A one-off script (raw `MongoClient`, same approach used earlier this session for the post-ownership migration — not `dbConnect()`, per this repo's centralized-connection rule) sets the real `sunil@gmail.com` account to `admin` and backfills `role: "reader"` on any other pre-existing non-seed accounts.

## Explicitly out of scope

- Notifications on approval/rejection/role changes — planned separately in `docs/roadmap.md` item 4, and depends on this feature existing first. The approve/reject/promote actions here are each a single, isolated function so wiring in a notification call later is a small addition, not a rework.
- Resurrecting `Comment.visibility` as a moderation toggle — it exists on the schema but is unused today; comment moderation here reuses the existing soft-delete mechanism instead of introducing a second one.
- Live session invalidation on role change (see the JWT limitation above).
