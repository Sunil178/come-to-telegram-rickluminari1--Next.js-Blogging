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

**Why now, and what's actually broken today:** the "editor" is TinyMCE loaded from vendored scripts (`src/components/tinymce.js`, global `<script>` tags in `layout.tsx`), styled with old CSS modules, completely outside the shadcn/Tailwind system. There is no edit flow at all — `POST /api/posts` (create) and `DELETE /api/posts/[slug]` exist, but nothing lets an owner change a post after publishing. The tag input (`src/components/post-tags.js`, via `react-tag-input`) has a leftover bug where its suggestion dropdown is hardcoded to a list of **country names** — clearly unfinished, not just unstyled. The banner-image uploader (`src/components/post-banner.js`) works but is FontAwesome/CSS-module styled. Code-block syntax highlighting is Prism.js loaded as vendored global scripts with no explicit wiring anywhere in the code (`Prism.highlightAll()` autoloader). None of this fits the design system the rest of the app has already moved to.

Researched against Plate's current (2026) docs, npm registry, and official templates (`udecode/plate-template`, `udecode/plate-playground-template` — both on React 19 / Next.js 16 / Tailwind 4, our exact stack) — confirmed live via `npm view`:
- Plate rebranded to package name **`platejs`** (not the old `@udecode/plate-common`). Latest stable **53.3.3** (54 is still beta — using stable). `@platejs/code-block@53.0.0`, `@platejs/media@53.1.4`, `lowlight@3.3.0`, `sonner@2.0.8` all confirmed published and compatible.
- Components install via the shadcn CLI against Plate's own registry (`npx shadcn@latest add @plate/<kit>`) — our `components.json` already works with this, no config changes needed. Local shadcn CLI confirmed at v4.17.0 (modern, supports this).
- Every kit ships as a **client variant** (`*-kit.tsx`, interactive, Plate UI components) and a **server-safe variant** (`*-base-kit.tsx`, no `/react` imports, used only for server-side HTML serialization). This split is load-bearing, not stylistic — Plate's docs are explicit that server/RSC code must never import `platejs/react`.
- Code blocks use **lowlight** (an AST wrapper around `highlight.js`), not Prism, not Shiki — confirmed from the kit's actual source. The repo already depends on `highlight.js` (currently dead weight — only its CSS is imported, never invoked), so this is a natural fit rather than a new library.

**Scope for the editor body** (kept intentionally tight for a single-author blog post, not the full "everything" playground demo): basic nodes (headings/paragraph/blockquote/hr, bold/italic/underline/strike/code), lists, links, images, code blocks, a fixed toolbar, autoformat (markdown-style typing shortcuts). Explicitly deferred as unnecessary for this app: AI/collab/comments/suggestions, math/excalidraw/columns/callouts, mentions/emoji/dates/footnotes, category selection (no category picker exists anywhere today — out of scope here, same as the current add page), and publish/approval controls on the edit form (matches what create already does; a dashboard approve/reject UI doesn't exist yet either).

**Content storage stays HTML, unchanged for existing posts.** The client editor holds/submits Plate's JSON document value (not a client-produced HTML string); a new server-only helper (`src/libs/post-editor-serialize.ts`, using `createSlateEditor` + the base kit + `platejs/static`'s `serializeHtml`) turns that JSON into the HTML string written to `Post.content` — inside the route handler, so the browser bundle never ships `platejs/static` or the static-only UI components. `POST /api/posts`'s existing hardening (auth, validation, the 409-on-duplicate-slug handling) is untouched; only how the `post_data` field is parsed changes (JSON value → serialize, instead of trusting a raw string). Loading existing HTML back into the editor for editing uses `editor.api.html.deserialize()` client-side. Read-time sanitization (DOMPurify+jsdom in `[slug]/page.tsx`) is unchanged and remains the actual XSS defense, same as today.

**New pieces:**
- `src/components/editor/` — `editor-kit.tsx` / `editor-base-kit.tsx` (aggregating per-feature `plugins/*-kit.tsx` / `*-base-kit.tsx` files, following Plate's own template convention) and `PostEditor.tsx` (the `<Plate>` wrapper used by both add and edit).
- `src/hooks/use-upload-file.ts` — replaces the pattern Plate's own template uses (which is wired to a third-party cloud service we don't want); ours POSTs to our existing hardened `/api/posts/upload` and adapts its `{ location }` response into the `{ key, url, name, size, type }` shape Plate's upload UI expects. Reused by both the in-editor image tool and the rebuilt banner uploader — one upload code path instead of two.
- `src/components/posts/PostForm.tsx` — shared by create and edit (title, slug w/ auto-derive-until-edited like today, description, tags, banner, `PostEditor` body), so `posts/add/page.tsx` and the new edit page are both thin wrappers instead of duplicated forms.
- `src/components/posts/TagInput.tsx` — small custom controlled component (chips via the already-installed `Badge` + `Input`) replacing `react-tag-input` outright, not just restyling it. A blog tag field doesn't need suggestions/drag-reorder, and this is what actually removes the countries-list bug rather than papering over it.
- `src/components/posts/PostBanner.tsx` — banner upload widget rebuilt on shadcn + the shared upload hook, replacing `post-banner.js`.
- `PATCH /api/posts/[slug]` (new, added alongside the existing `DELETE` in the same file) — ownership-scoped via `withApiGuard` + `{ slug, userId: session.user.id }` exactly like `DELETE` already does; shares the same serialize helper as `POST`.
- `src/app/posts/[slug]/edit/page.tsx` (new) — direct-DB fetch scoped to `{ slug, userId }` (owner-only, `notFound()` otherwise — deliberately stricter than the read page's "public OR owner" logic, since edit access should never depend on publish state). Needs a real entry point too, not just the route: an edit action in `/dashboard/posts` for the owner's own posts.
- Needed shadcn additions: `textarea`, `label`, `sonner` (Plate UI's own upload-error-toast component depends on it; this repo currently has no toast library at all).

**Syntax highlighting for the read view:** the stored HTML is inserted via `dangerouslySetInnerHTML`, not re-rendered through Plate — so highlighting it is a DOM-highlighting job, not an AST job. Use `highlight.js`'s own `hljs.highlightElement()` directly on rendered `<pre><code>` blocks (making the already-installed-but-dead `highlight.js` dependency load-bearing), replacing the vendored Prism scripts/CSS and the dead `highlight.js/styles/default.css` import with a real, dark-mode-appropriate theme. First step here: verify empirically (write a code block, save, inspect the stored HTML) whether Plate's `serializeHtml()` already bakes lowlight's highlighting into the static markup — the design works either way (highlight.js no-ops on already-highlighted elements), but it's worth knowing which is actually happening.

**Full legacy removal** once nothing references it: `tinymce`, `@tinymce/tinymce-react`, `prismjs`, `react-tag-input` from `package.json`; vendored `public/assets/libs/tinymce/` and `public/assets/libs/prism.js/`; `src/components/tinymce.js`, `tinymce-constants.js`, `post-tags.js`, `post-banner.js`; `src/styles/post.module.css`, `post-banner.module.css`, `post-tags.css`; the `postinstall` script line; the orphaned unused `src/plugin/prism-line-numbers.min.js` duplicate found during this phase's audit. Also bundling in `antd`, `@ant-design/nextjs-registry`, and `copy-webpack-plugin` — all three confirmed at zero usage anywhere in `src` already (Ant Design was fully migrated off in earlier phases; `copy-webpack-plugin` was never actually wired into `next.config.mjs` despite being a dependency). `@fortawesome/*` stays for now — still genuinely used by `src/app/auth/register/password.js`, which is Phase 6 territory, not this phase.

**Sequencing** (5 independently testable/committable steps, per the workflow above):
1. Install `platejs` + kits + `sonner` via the shadcn CLI; mount `<Toaster />`. No page wiring yet — verify `npm run build`/`dev` still pass unchanged.
2. Build the editor module + upload hook + serialize helper; adapt `POST /api/posts`; build `PostForm`/`TagInput`/`PostBanner`; rewrite `posts/add/page.tsx`. Verify: create a real post end-to-end (banner, tags, code block, inline image) through the browser.
3. Add `PATCH /api/posts/[slug]`, the edit page, and its dashboard entry point. Verify: edit as owner works and round-trips content correctly; loading `/posts/<slug>/edit` as a different user 404s; logged-out redirects to login.
4. Swap read-view syntax highlighting; remove Prism entirely. Verify: a published post with multiple code-block languages highlights correctly, no console errors.
5. Remove all remaining legacy deps/files listed above. Verify: `rm -rf node_modules && npm install` (postinstall now a no-op) + full `npm run build` + one more end-to-end smoke test.

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
