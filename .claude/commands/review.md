---
description: Deep, stack-aware code review of a diff. Detects the project's languages/frameworks/datastores, reviews through parallel specialist lenses, verifies every finding through an independent pass, and reports only what survives. Works on local changes without GitHub CLI.
argument-hint: [ref | ref..ref | PR# | path | --staged | --all]
---

Review changed code and report defects. Review only — never edit, fix, or commit anything unless explicitly asked in a later message.

## 1. Resolve what to review

From `$ARGUMENTS`:

- empty → review uncommitted work (`git diff HEAD`); if the tree is clean, review this branch against its merge-base with the default branch (`git merge-base HEAD origin/main` or `master`/`develop` — whichever exists)
- `--staged` → `git diff --cached`
- `--all` → the whole branch vs. merge-base, ignoring working-tree state
- `<ref>` → that commit vs. its parent; `<ref>..<ref>` → that range
- a path → restrict any of the above to that path
- a bare number → a PR, only if `gh` is installed and authenticated; otherwise say so and fall back to the branch diff

Gather: `git diff <range>`, `git diff --stat <range>`, `git log --oneline <range>`. Read the **full diff**, never just the stat. Then read each changed file in full — a diff hunk hides the context that decides whether a change is correct. This full read matters even for prose/doc-only changes: a partial edit can leave a cross-reference (e.g. "see the Sequencing section below") pointing at a heading the same diff removed, and a hunk-only read won't surface that — read the file as a reader would, start to finish.

Exclude from review (note them, don't analyze): lockfiles, generated/compiled output, vendored dependencies, snapshots, minified assets, binary files, and any path matching the project's own generated-file conventions.

If the diff is very large (>2000 changed lines), review the highest-risk files first — anything touching auth, money, migrations, permissions, or public interfaces — and state explicitly what you did not reach.

## 2. Detect the stack

Never assume the stack. Identify it from what's actually in the repo, then apply only the relevant checklists in section 5.

Read whichever manifests exist: `package.json`, `pnpm-workspace.yaml`, `deno.json`, `pom.xml`, `build.gradle(.kts)`, `requirements.txt`, `pyproject.toml`, `Pipfile`, `go.mod`, `Gemfile`, `composer.json`, `Cargo.toml`, `*.csproj`, `mix.exs`, `pubspec.yaml`. From dependencies and directory layout, determine: language(s) and version, frontend framework, backend framework, ORM/data access layer, datastore(s), test framework, and whether it's a monorepo with multiple stacks (review each changed workspace under its own stack).

Also note the datastore's shape — relational, document, key-value, search, queue — since the data-layer checks differ sharply between them.

## 3. Load the project's own rules

Project conventions outrank general best practice. Read, if present: `CLAUDE.md` / `AGENTS.md` (root and in changed directories), `CONTRIBUTING.md`, `docs/` architecture or ADR files, `.editorconfig`, linter/formatter/type-checker configs, and any code comments in the changed files that state intent or constrain how the code may be used.

Where a convention isn't documented, infer it from the immediate neighbours — sibling modules, the other handlers in the same directory, the adjacent test file. A change that's reasonable in isolation but breaks the pattern every sibling follows is a real finding; a general-practice preference the project has visibly and deliberately rejected is not.

## 4. Run parallel review passes

Scale the effort to the change. A handful of changed lines: review inline yourself, no subagents. Anything larger: launch these as parallel subagents, each returning findings with file, line, the claim, and the evidence. Give each agent the diff range, the detected stack, and the paths of the convention files from section 3.

1. **Correctness** — logic errors, wrong conditionals, off-by-one, null/undefined paths, error handling, edge cases at empty/zero/max/duplicate/unicode inputs.
2. **Security & access control** — authn/authz, tenancy isolation, injection, secrets, untrusted input.
3. **Data layer** — queries, transactions, migrations, indexes, consistency.
4. **Interface contracts** — public API/schema/event/config changes and their backward compatibility for existing callers, stored data, and in-flight clients.
5. **Conventions & structure** — adherence to section 3's rules, layering and module boundaries, duplication, and whether the change respects the stated intent of the code it modifies.
6. **History** — `git log`/`git blame` on the modified regions: does this reintroduce a previously fixed bug, undo a deliberate workaround, or contradict a fix's commit message?
7. **Tests & observability** — is the new behaviour actually covered, and is a failure diagnosable in production?
8. **Regression risk** — for each changed function, endpoint, type, component, or schema object, find its callers and consumers (grep the repo, don't assume) and confirm the change is safe for every one of them. Core existing flows must still work; a change that is correct in isolation but silently breaks a caller is a blocker.

Skip any pass with nothing to examine (no migrations changed → no migration review).

## 5. Stack checklists

Apply what matches the detected stack.

**Frontend (React / Next.js / Vue / Angular / Svelte / any)**
Direct mutation of state the framework expects replaced immutably; missing cleanup on unmount/teardown leaking timers, subscriptions, listeners, or observers; async responses landing after the component moved on or unmounted, with no cancellation or ordering guard; stale closures over props/state in callbacks and effects; effect/watcher dependencies missing or causing re-run loops; list keys derived from array index where items reorder; controlled/uncontrolled input switching; browser globals (`window`, `document`, `localStorage`) touched at module scope or during SSR, and server/client component boundaries crossed incorrectly; unbatched or per-item network calls in a loop; user-controlled HTML injected via `innerHTML`/`dangerouslySetInnerHTML`/`v-html`; interactive elements without keyboard access, labels, or focus management; large modules imported eagerly that should be lazy; expensive computation re-run on every render, or freshly-created callbacks/objects passed into memoized children and defeating the memoization; long lists rendered without windowing; async UI with no loading, error, and empty states; layouts that break at small viewports.

**Backend / API (Express / Fastify / Spring Boot / Django / Flask / FastAPI / Rails / .NET / any)**
A new or changed endpoint missing the auth middleware its siblings have; authorization checked for the action but not for ownership of the specific object (IDOR); tenant/org/workspace scoping absent from a query in a multi-tenant system; request input unvalidated, or a whole request body assigned onto a model or entity (mass assignment); internal errors, stack traces, or identifiers leaked in responses; swallowed exceptions; wrong or inconsistent status codes; unbounded list endpoints with no pagination cap; expensive or public endpoints with no rate limit; retryable and webhook handlers without idempotency; outbound HTTP/RPC calls with no timeout, and sequential external calls whose timeouts stack into an unbounded worst case; blocking or long-running work inside the request path; background jobs with no retry, backoff, or failure surface; secrets or personal data written to logs; endpoints inconsistent with their siblings in route naming, HTTP method choice, or error-response shape.

**Data layer (SQL, document, key-value, search, any ORM)**
Queries issued inside a loop or triggered by lazy-loading a relation per row (N+1); a new filter, sort, or join column with no supporting index; multi-step writes that must be atomic but aren't in one transaction; transactions held open across network calls or user-facing latency; read-modify-write sequences without locking, a conditional update, or a unique constraint to prevent lost updates; soft-delete, archive, or status filters dropped from a query that needs them; raw query strings built by concatenating user input; cursors/connections not released; columns, rows, or relations fetched but never used, and joins that don't narrow the result; and for document or key-value stores, unbounded scans, missing partition/shard keys, and writes that assume a schema the existing data doesn't have.

Where the project has seed or fixture data, changed seeders should produce data that is realistic, internally consistent, and valid against the current schema and its constraints.

**Migrations & schema changes**
Not backward compatible with the currently-deployed code that will run against it during rollout (a rename or drop done in one step rather than expand-then-contract); destructive or irreversible without a stated recovery path; no down/rollback; a lock-taking or full-table-rewrite operation on a table large enough to cause an outage; a new non-nullable column added without a default or backfill; a constraint added without validating existing rows.

**Security (all stacks)**
Credentials, tokens, or keys committed or hardcoded; injection of any kind — SQL, NoSQL, OS command, template, LDAP, header; path traversal in file operations; server-side request forgery on user-supplied URLs; deserialization of untrusted input; passwords hashed with a fast or general-purpose algorithm; tokens or IDs from a non-cryptographic random source; secrets compared non-constant-time; CORS wildcards combined with credentials; state-changing cookie-authenticated endpoints without CSRF protection; uploads accepted without type, size, and destination-path validation; and newly added dependencies that are unmaintained, unexpectedly broad in scope, or a near-miss on a well-known package name.

**Concurrency & async**
Promises/futures/goroutines started and never awaited or joined, so failures vanish; per-request or per-user data stored in module-level, static, or singleton state shared across requests; locks acquired in inconsistent order; cancellation/context not propagated to callees; retries without backoff amplifying an outage; a check-then-act sequence gated on a cookie, cache entry, header, or other piece of state that hasn't round-tripped yet, letting concurrent requests (double-tab, fast double-navigation, retry-on-timeout) each pass the check before either write is visible to the other.

**Config, infra & CI**
A new environment variable with no default, no documentation, and no deployment-config entry; a feature flag whose default changes behaviour for everyone on deploy; containers running as root, secrets passed as build args, or floating `latest` base images; CI changes that expose secrets to untrusted pull requests or cache in a way that can serve stale or poisoned artifacts; infrastructure definitions opening public access to storage, databases, or network ports.

**Structure & layering (all stacks)**
Logic duplicated into a second or third place that should be one shared unit; a file this change pushes past roughly 250 lines while carrying more than one responsibility, or a service/util/helper accumulating unrelated functions into a god-module; forms, tables, modals, pickers, or list rows defined inline inside page/route/container files rather than extracted into their own components, leaving the page doing more than orchestrating state and composing children; layer violations against the project's own architecture — business rules in controllers or repositories, data access in services, side effects in helpers meant to be pure; a service or repository spanning several unrelated domains; connections, clients, caches, or config objects constructed per call instead of held once; and dependencies hardcoded inside a unit where the project injects them, making the unit untestable.

**Language gotchas** — check only the languages present.
*JS/TS*: `any` or assertions defeating a type guarantee at a real boundary; floating promises; `==` on mixed types; default lexicographic `sort`; unguarded `JSON.parse`; timezone-naive date handling.
*Python*: mutable default arguments; bare `except`; blocking calls inside `async def`; naive vs. aware datetimes; late-binding closures in loops.
*Java/Kotlin*: `@Transactional` (or similar proxy-based annotations) invoked from within the same class and silently not applied; mutable state on singleton beans; `equals`/`hashCode` on JPA entities with generated IDs; unguarded `Optional.get()`.
*Go*: ignored `error` returns; missing `defer` close; writes to a nil map; `context` not threaded through.
*Ruby/PHP*: mass assignment without a permitted-parameter filter; N+1 via lazy associations; model callbacks with side effects that break in bulk operations.

**Tests**
New behaviour with no test exercising it; a test that asserts nothing meaningful or would pass with the implementation removed; the unit under test mocked out; dependence on real time, real network, or execution order; snapshots regenerated without inspecting the diff.

## 6. Verify before reporting

Every candidate finding must be verified against the actual code — not the diff alone — before it can be reported. For each one, state:

- the exact file and line,
- the concrete trigger: specific inputs, state, or sequence that reaches it,
- the observable wrong outcome: what breaks, for whom.

**If you cannot write a concrete trigger and outcome, drop the finding.** This is the single most important filter — a defect you can't make happen isn't a defect, it's a hunch.

Before scoring, trace every value the finding depends on back to *every* place that produces it — not just the primary or UI-driven path, but every producer a caller could realistically reach (a direct API call, an admin tool, a script, a different role, a bypassed client). Grep for it; don't assume a value is "already validated," "always well-formed," or "safe because the UI sanitizes it" without reading the code that actually produces it. Treating an unverified assumption as settled fact is the single most common way a real, reachable bug gets waved away as theoretical.

**Score confidence in a genuinely separate pass, not the same reasoning that found the issue.** The context that generated a candidate is prone to confirming its own reasoning — it already has a story for why the finding is or isn't real, and will tend to talk itself into agreeing with itself. Spawn a subagent (one per candidate, or one covering the whole batch for a small diff) and give it *only*: the candidate finding as stated, the relevant file excerpts, and the stack/convention context from section 3 — not the discovery reasoning or verification narrative that produced it. That agent scores confidence 0–100 using the rubric below, and does its own trace of the value's origin rather than trusting the finder's trace. Do not self-score.

- **0** — false positive, or a pre-existing issue this change didn't introduce
- **25** — plausible but unverified
- **50** — real but rare, minor, or unimportant relative to the change
- **80** — verified by reading the code; will be hit in practice; the current approach is genuinely insufficient
- **100** — certain, with direct evidence in the code

Keep only findings the independent pass scores **≥80**.

For a convention violation, confirm the rule is actually written in the file you're citing and quote it. If you're inferring it from sibling code instead, say so and cite the sibling.

## 7. Not findings

Do not report: pre-existing issues on lines this change didn't touch; anything a linter, formatter, type-checker, or compiler catches (assume CI runs them — never run builds or test suites yourself as part of this review); style preferences not stated in the project's own rules; nitpicks a senior engineer would let through; missing tests or docs as a blanket complaint rather than for specific risky logic; behaviour changes that are clearly the intent of the change; theoretical concerns with no reachable path; and issues already silenced by an explicit suppression comment.

"Behaviour changes that are clearly the intent of the change" means the *specific* residual risk under review was itself named and accepted somewhere (a spec, an issue, a comment saying this exact gap is fine) — not merely that some adjacent or related design choice was deliberate. A mechanism built to solve one problem (e.g. a cookie that dedupes accidental repeat counts) does not, by itself, establish that the design was also evaluated against a different threat (e.g. adversarial abuse from a client that never sends the cookie back) — those are separate questions, and only the one the spec actually addresses gets excluded.

Structural findings from section 5 — duplication, file size, extraction, layering — are subject to that same rule: report them when **this change** introduced or measurably worsened them (it added the duplicate copy, it grew the file past the threshold, it put the new business rule in the controller). A file that was already oversized or already mislayered before this change is not a finding, however much it deserves one; mention it at most once in the closing paragraph, never as a numbered finding.

Never manufacture findings to appear thorough. Reporting nothing on a clean change is a correct result — say so plainly.

## 8. Report

Rank most severe first, using: **blocker** (data loss or corruption, security exposure, breaks production, breaks a contract existing clients depend on) → **high** (wrong behaviour on a realistic path, or a regression users will notice) → **medium** (correct today but fragile, or an unhandled edge case) → **low** (a maintainability cost concrete enough to name).

Tag each finding with the layer it belongs to — Frontend, Backend, API, Database, Migration, Seeder, Infra, Architecture, or Tests — so related findings can be read and fixed together.

If the `ReportFindings` tool is available, report through it, most severe first, and don't also print the findings as prose. Otherwise print each finding as:

```
[severity] [layer] path/to/file.ext:LINE — one-line statement of the defect
Trigger: the specific inputs/state that reach it
Impact: what breaks, for whom
Fix: the direction to take, in a sentence — not a patch
```

Then close with:

- **Verdict** — one of *ship-ready* (nothing above low), *needs fixes* (blockers or highs that are individually addressable), or *needs rework* (the change's approach or structure is wrong, not just its details). Commit to one; don't hedge.
- **Scope** — lines added/removed, what the change does, what you reviewed, and anything you deliberately skipped or couldn't reach.
- If fixes are needed, the order to do them in — by impact and by dependency, since some fixes make others moot.

If `gh` is available and the review targeted a PR, offer to post the review as a comment rather than posting unprompted.
