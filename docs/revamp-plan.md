# Vede.Guru Blog — Complete Revamp Plan

## Context

This is a personal Next.js 16 / React 19 / MongoDB blog that's grown organically through experimentation — it currently has three different rich-text editor libraries installed (only one wired up), an admin-only data table sitting where the public blog listing should be, and a design built from unstyled Ant Design defaults. The goal is a full revamp: modern animated UI/UX, a real public blog experience, a fully working editor and comment/voting system, and closed security holes — while keeping the existing MongoDB data (posts, users, categories, uploaded images) intact.

Decisions already made with the user:
- **UI stack**: Tailwind CSS + shadcn/ui + Motion (framer-motion's successor), replacing Ant Design, FontAwesome, styled-components, PrimeReact.
- **Editor**: Plate (shadcn-native, MIT, no paid tier), replacing TinyMCE and the dead draft-js/react-quill leftovers.
- **Uploads**: keep local filesystem, harden it (no migration to cloud storage).
- **Deployment target**: undecided — design for portability, don't hard-code a Vercel-only or VPS-only assumption.
- **Comments & voting**: build fully (currently 0% wired — schema exists, no API/UI at all).

### Critical findings from codebase audit (why this is more than a paint job)
- `POST /api/posts` (create), `DELETE /api/posts/[slug]` (delete, and it hard-deletes bypassing the soft-delete plugin), and `POST /api/posts/upload` have **zero auth checks** — anyone can create/delete posts or upload files right now.
- `/posts/add` (the authoring page) and the admin table at `/posts` render with **no session check at all**, and there is **no `middleware.ts`** in the app — `src/middleware/` is an empty directory and `src/proxy.ts` defines an unused `auth` export that's never wired into routing.
- The Navbar links to `/dashboard`, which **doesn't exist**.
- `Comment`, `CommentVote`, `PostVote`, `UserVote` models exist with no `required` fields and no unique compound indexes (nothing stops duplicate votes at the DB level), and have zero API routes or UI anywhere.
- Significant dead code: `src/components/Trials/` (12 files, draft-js/react-quill/styled-components experiments, zero imports), `src/app/posts/page-backup.js` (old gridjs table, unused, no-confirmation delete), `src/components/csrf.js`, `src/components/utils.js`, `src/components/PrimeReact.js` (imports a package not even in `package.json`), `src/app/api/auth/register/route.ts` (superseded by the server action `src/actions/register.ts`, which is what's actually wired to the register form), `src/styles/globals.css` (import is commented out), `.eslintrc.json` (superseded by `eslint.config.mjs` flat config).
- Unused dependencies confirmed by grep (zero usages outside dead files): `draft-js`, `draftjs-utils`, `markdown-draft-js`, `@aloushek/react-draft-wysiwyg-next`, `react-quill-new`, `quill-image-resize-module-react`, `gridjs`, `gridjs-react`, `react-dnd`, `react-dnd-html5-backend`, `styled-components`.

## Approach

This is too large for one pass. I'll execute it in the phases below, in order, and check in with you after each phase (or logical group of phases) rather than attempting everything at once — that keeps the app in a working, deployable state throughout instead of a long stretch of broken intermediate states.

## Workflow & process
- Work happens on the already-checked-out `feature/full-revamp` branch.
- Changes within a phase are auto-accepted (no per-edit confirmation) — but nothing gets committed until you've tested and approved that phase.
- After each phase is implemented, I'll stop and give you concrete manual test steps for what changed.
- Once you confirm it works, I'll give you one final, conclusive commit message for that phase (not a trail of incremental fix-up messages from anything we iterated on along the way).
- This plan is saved at `/home/sunil/.claude/plans/resilient-kindling-karp.md` and will also be copied to `docs/revamp-plan.md` in the repo for reference.

---

### Phase 0 — Critical security fixes (do first, independent of design work)
- Add `auth()` session checks (reuse the pattern already in `src/components/Navbar.tsx`) to `POST /api/posts` (`src/app/api/posts/route.ts`) and `DELETE /api/posts/[slug]` (`src/app/api/posts/[slug]/route.ts`); return 401 for unauthenticated requests.
- Change the delete route to use the model's soft-delete method (from `mongoose-delete`, already plugged into `Post.ts`) instead of `Post.deleteOne`.
- Harden `POST /api/posts/upload` (`src/app/api/posts/upload/route.ts`): require auth, allowlist image MIME types/extensions, cap file size, and derive the stored filename instead of trusting the raw `file.name` from the client.
- Create `src/middleware.ts` using the existing `auth` export pattern from `src/proxy.ts`/`src/auth.config.ts` to protect `/posts/add` and the future `/dashboard` routes at the routing layer (defense in depth alongside the API-level checks above).
- Delete `src/app/api/auth/register/route.ts` (dead, weaker-validated duplicate of `src/actions/register.ts`, and it currently leaks raw Mongo error objects in JSON responses).
- Audit remaining API responses for leaked internals (e.g. `{ data: error }` patterns) and replace with generic messages + server-side logging.

### Phase 1 — Dead code & dependency cleanup
- Delete: `src/components/Trials/`, `src/app/posts/page-backup.js`, `src/components/csrf.js`, `src/components/utils.js`, `src/components/PrimeReact.js`, `src/styles/globals.css`, `.eslintrc.json`.
- Remove the now-unused deps listed above from `package.json`, run `npm install`, confirm `npm run build` still passes.

### Phase 2 — Foundation: Tailwind + shadcn/ui + Motion
- Install Tailwind CSS v4, initialize shadcn/ui, install `motion` and `lucide-react` (shadcn's default icon set, replacing `@fortawesome/*`).
- Define design tokens (light/dark color palette, typography scale, spacing) as Tailwind theme/CSS variables; set up dark mode.
- Replace `@fontsource/roboto` with `next/font` for automatic self-hosted font optimization.
- Note: Ant Design (`antd`, `@ant-design/nextjs-registry`) can't be removed until every surface using it is migrated (Phases 3–4, 6) — it stays installed until then.

### Phase 3 — Core layout & shared UI
- Rebuild `Navbar.tsx` with shadcn components + Motion transitions (mobile menu, avatar dropdown); fix the broken `/dashboard` link once Phase 6 creates that route. Convert its raw `<img>` avatar to `next/image`.
- Rebuild `Footer.tsx`.
- Rebuild `GlobalLoader.tsx` as a route-transition indicator without antd's `Spin`.

### Phase 4 — Homepage & public blog experience
- Redesign `Hero.tsx`/`Features.tsx` with Motion entrance/scroll animations.
- Rebuild `Articles.tsx` as a real animated card grid.
- Split the current `/posts` route: the public blog listing (card grid, category filter, search, pagination) replaces what's there now; the existing admin data table (currently at `src/app/posts/page.tsx`) moves to a protected `/dashboard/posts` route (Phase 6).
- Rebuild `src/app/posts/[slug]/page.js`: proper article layout (banner, author/date/read-time, table of contents, Tailwind Typography prose, reading-progress bar) — keep the existing DOMPurify+jsdom sanitization, it's still needed since content is stored as raw HTML.
- Add per-post SEO via Next's native `generateMetadata`.

### Phase 5 — Editor migration to Plate
- Install Plate + its shadcn-native editor-kit components; build the toolbar in Tailwind/shadcn.
- Rebuild `src/app/posts/add/page.js` and add a genuinely missing **edit** flow (`src/app/posts/[slug]/edit/page.tsx` — there is currently no way to edit a published post, only create/delete) on Plate, serializing to HTML on save so the existing render path in `[slug]/page.js` keeps working unchanged.
- Wire Plate's image upload to the hardened `/api/posts/upload` endpoint.
- Pick a code-block syntax highlighter for both the editor and the read view (e.g. Shiki) to replace the vendored Prism.js files.
- Remove TinyMCE entirely: `src/components/tinymce.js`, `tinymce-constants.js`, the `postinstall` script and `copy-webpack-plugin` config in `next.config.mjs`, vendored `public/assets/libs/tinymce/`, and the `tinymce`/`@tinymce/tinymce-react` deps. Remove vendored `public/assets/libs/prism.js/` and related deps once the new highlighter is in.

### Phase 6 — Auth, dashboard, route protection
- Rebuild `src/app/auth/login/page.tsx`, `register/page.tsx`, `register/password.js` with the new design system.
- Build `/dashboard/posts` housing the migrated admin table (Ant `Table` → shadcn `DataTable`), protected by the Phase 0 middleware.
- Add a delete-confirmation dialog (shadcn `AlertDialog`) — the old `page-backup.js` deleted posts with no confirmation at all; don't repeat that.

### Phase 7 — Comments & voting (net-new feature)
- API routes: `POST/GET /api/posts/[slug]/comments`, `POST /api/posts/[slug]/vote`, `POST /api/comments/[id]/vote` — all mutations require auth.
- Add unique compound indexes to prevent duplicate votes: `CommentVote(userId, commentId)`, `PostVote(userId, postId)`, `UserVote(userId, votingUserId)`; add `required` on the fields that should never be empty (`Comment.postId/userId/content`, vote `userId`/target id/`type`).
- Update denormalized counters (`Post.commentCount/upvoteCount/downvoteCount`, `Comment.upvoteCount/downvoteCount`) atomically via `$inc` on comment/vote create-or-remove.
- Build UI: threaded comments (using existing `Comment.parentId`) with optimistic updates + Motion transitions, upvote/downvote controls on posts and comments.
- Scope note: voting/commenting will require login (no anonymous fingerprint-based flow) — the `TempUser`/`UserInterest` models stay out of scope unless you want that built separately later.

### Phase 8 — Performance, testing, polish
- Add Vitest + Testing Library; cover the highest-risk paths first: auth guards, upload validation, vote/comment mutation logic.
- Full `next/image` audit, loading/error boundaries per route, accessibility pass (mostly free from shadcn's Radix primitives, but verify).
- Remove `antd`, `@ant-design/nextjs-registry`, `@fortawesome/*` once every surface has migrated off them.
- Optional: basic GitHub Actions CI (lint + typecheck + build) if/when you're ready to push this to a remote — flagging as optional since there's no CI or confirmed git remote today.

## Verification (per phase)
- `npm run build` and `npm run lint` must pass after every phase.
- Phase 0: manually confirm (via curl or an incognito browser) that unauthenticated `POST /api/posts`, `DELETE /api/posts/[slug]`, and `POST /api/posts/upload` now return 401, and that visiting `/posts/add` while logged out redirects to login.
- Phase 4/5: manually create, edit, and view a post end-to-end through the browser (dev server via `npm run dev`) to confirm the authoring → storage → render pipeline still works after the editor swap.
- Phase 7: manually verify duplicate votes are rejected (DB unique index) and comment/vote counts on a post stay consistent after create/delete cycles.
- No existing automated tests to preserve; Phase 8 is where test coverage gets introduced.
