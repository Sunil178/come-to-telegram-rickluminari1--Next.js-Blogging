# Roles & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a four-tier role system (Reader → Author → Moderator → Admin) and the admin surfaces it unlocks: a cross-user post review queue, comment moderation, publish-request approval, user role management, and category management.

**Architecture:** `User.role` is the source of truth, carried into the NextAuth JWT/session (same pattern already used for `username`); a shared `hasRole()` helper in `src/libs/roles.ts` is the one place rank comparison happens, reused by edge middleware (`proxy.ts`), the API guard (`withApiGuard`'s new `role` option), and route handlers that need ownership-or-role checks. New Server Component pages under `/dashboard/admin/*` do direct Mongoose reads (matching how `/dashboard/posts` already works); mutations go through small `withApiGuard`-wrapped Route Handlers called from client "action" components that follow the existing `DeletePostButton` fetch/toast/`router.refresh()` pattern.

**Tech Stack:** Next.js 16 App Router, NextAuth v5 (JWT sessions), Mongoose + `mongoose-delete`, Vitest (route/lib unit tests with mocked models, matching existing convention — no DB integration tests, no component-render tests exist in this repo today), shadcn/ui (`Table`, `DropdownMenu`, `Dialog`, `Badge`, `Button`).

**Spec:** `docs/superpowers/specs/2026-08-15-roles-permissions-design.md` — this plan implements that spec exactly; read both together. One refinement made at planning time, not in the spec: because `User.findOne(...)` in `authorize()` returns a hydrated Mongoose document (not `.lean()`), the schema's `default: "reader"` on `role` already applies in-memory to every pre-existing account with no `role` in the database — so the migration only needs to *explicitly set* accounts that should be above Reader, not backfill Reader onto everyone else.

## Global Constraints

- Every mutating API route is wrapped with `withApiGuard` — no inline auth/role logic in route files (`CLAUDE.md` / `api-route-security` skill).
- Never hard-delete `Post`/`Comment`/`Category` documents — moderation and admin deletes go through the existing `mongoose-delete` soft-delete, same as owner-initiated deletes.
- `role` comparisons always go through `hasRole()` from `src/libs/roles.ts` — never compare `ROLE_RANK` inline in a route/page/component.
- Dev server runs on port 5000 (`npm run dev -- --port=5000`); if a task's manual-verification step starts it, kill it before finishing (`ss -ltnp | grep :5000` to confirm free) — don't touch it if the user's own instance is already running.
- Run `npx tsc --noEmit` and `npm test` after every task; both must be clean before moving to the next task.

---

## Task 1: Role model — `src/libs/roles.ts`

**Files:**
- Create: `src/libs/roles.ts`
- Test: `src/libs/roles.test.ts`

**Interfaces:**
- Produces: `type RoleName = "reader" | "author" | "moderator" | "admin"`, `const ROLE_RANK: Record<RoleName, number>`, `function hasRole(role: RoleName | undefined, minimum: RoleName): boolean`. Every later task imports `hasRole`/`RoleName` from here — nowhere else defines role ranking.

- [ ] **Step 1: Write the failing test**

```ts
// src/libs/roles.test.ts
import { describe, expect, it } from "vitest";
import { hasRole } from "@/libs/roles";

describe("hasRole", () => {
    it("returns true when the role meets the minimum", () => {
        expect(hasRole("admin", "moderator")).toBe(true);
        expect(hasRole("moderator", "moderator")).toBe(true);
    });

    it("returns false when the role is below the minimum", () => {
        expect(hasRole("reader", "author")).toBe(false);
        expect(hasRole("author", "moderator")).toBe(false);
    });

    it("treats an undefined role as reader", () => {
        expect(hasRole(undefined, "reader")).toBe(true);
        expect(hasRole(undefined, "author")).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/libs/roles.test.ts`
Expected: FAIL — `Cannot find module '@/libs/roles'`

- [ ] **Step 3: Write the implementation**

```ts
// src/libs/roles.ts
export type RoleName = "reader" | "author" | "moderator" | "admin";

export const ROLE_RANK: Record<RoleName, number> = {
    reader: 0,
    author: 1,
    moderator: 2,
    admin: 3,
};

export function hasRole(role: RoleName | undefined, minimum: RoleName): boolean {
    return ROLE_RANK[role ?? "reader"] >= ROLE_RANK[minimum];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/libs/roles.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/libs/roles.ts src/libs/roles.test.ts
git commit -m "Add the role ranking helper the rest of the role system builds on"
```

---

## Task 2: `User.role` field

**Files:**
- Modify: `src/models/User.ts`

**Interfaces:**
- Consumes: `RoleName` from `src/libs/roles.ts` (Task 1).
- Produces: `IUser.role: RoleName`, schema field `role` (enum of the four values, default `"reader"`).

- [ ] **Step 1: Add the field**

In `src/models/User.ts`, add the import and extend the interface + schema:

```ts
import type { RoleName } from "@/libs/roles";
```

```ts
export interface IUser extends IUserWithSoftDelete {
  tempUserId: Types.ObjectId;
  username: string;
  firstName: string;
  middleName: string;
  lastName: string;
  mobile: string;
  email: string;
  password: string;
  avatar: string;
  intro: string;
  profile: string;
  role: RoleName;
  upvoteCount: number;
  downvoteCount: number;
  lastLoginAt: Date;
}
```

```ts
const schema = new Schema<IUser>(
  {
    tempUserId: { type: ObjectId, ref: "TempUser" },
    username: String,
    firstName: String,
    middleName: String,
    lastName: String,
    mobile: String,
    email: String,
    password: String,
    avatar: String,
    intro: String,
    profile: String,
    role: { type: String, enum: ["reader", "author", "moderator", "admin"], default: "reader" },
    upvoteCount: Number,
    downvoteCount: Number,
    lastLoginAt: Date,
  },
  {
    timestamps: true,
  }
);
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (no test exists for a pure schema addition — this is verified by every later task that reads/writes `user.role` type-checking correctly).

- [ ] **Step 3: Commit**

```bash
git add src/models/User.ts
git commit -m "Add a role field to User, defaulting new accounts to reader"
```

---

## Task 3: Wire `role` through the NextAuth session/JWT

**Files:**
- Modify: `src/types/next-auth.d.ts`
- Modify: `src/auth.config.ts`
- Modify: `src/app/api/auth/[...nextauth]/auth.ts`

**Interfaces:**
- Consumes: `RoleName` (Task 1).
- Produces: `session.user.role: RoleName | undefined` available everywhere a session is read, including `proxy.ts`'s edge instance.

This task also moves the `session`/`jwt` callbacks from `auth.ts` into the shared `auth.config.ts`, so the edge-only `NextAuth(authConfig)` instance `proxy.ts` builds gets the exact same field-copying behavior as the full instance, instead of two configs that could silently drift. `auth.ts` currently re-declares `callbacks` as an object-literal key alongside `...authConfig`, which fully overwrites whatever `authConfig` defines — after this change it stops re-declaring `callbacks` at all, so both instances share one implementation.

- [ ] **Step 1: Extend the type augmentation**

```ts
// src/types/next-auth.d.ts
import type { DefaultSession, DefaultUser } from "next-auth";
import type { RoleName } from "@/libs/roles";

declare module "next-auth" {
    interface Session {
        user: {
            username?: string;
            role?: RoleName;
        } & DefaultSession["user"];
    }

    interface User extends DefaultUser {
        username?: string;
        role?: RoleName;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        username?: string;
        role?: RoleName;
    }
}

// `@auth/core/index.d.ts` (which `next-auth`'s own callback types are built on) imports
// `JWT` straight from `@auth/core/jwt` rather than through the `next-auth/jwt` re-export,
// so the augmentation above alone doesn't reach the `token` param in our `session` callback.
declare module "@auth/core/jwt" {
    interface JWT {
        username?: string;
        role?: RoleName;
    }
}
```

- [ ] **Step 2: Move the callbacks into the shared config**

```ts
// src/auth.config.ts
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

export default {
    providers: [Credentials],
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.username = token.username;
                session.user.role = token.role;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.username = user.username;
                token.role = user.role;
            }
            return token;
        },
    },
} satisfies NextAuthConfig;
```

- [ ] **Step 3: Stop re-declaring callbacks in the full instance, and pass `role` out of `authorize()`**

```ts
// src/app/api/auth/[...nextauth]/auth.ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import User from "@/models/User";
import authConfig from "@/auth.config";
import { compareSync } from "bcrypt";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                const user = await User.findOne({ email: credentials.username });

                if (user && compareSync(credentials.password as string, user.password)) {
                    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
                    return {
                        id: user.id,
                        name: fullName || user.username,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                    };
                }
                return null;
            },
        }),
    ],
    pages: {
        signIn: '/auth/login',
    },
});
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual verification**

Start the dev server (`npm run dev -- --port=5000` if not already running), log in as any existing account, and confirm login still works and the dashboard still loads (this task changes auth plumbing with no behavior change yet — role gating isn't wired into any route until Task 5). Kill the dev server afterward if you started it.

- [ ] **Step 6: Commit**

```bash
git add src/types/next-auth.d.ts src/auth.config.ts "src/app/api/auth/[...nextauth]/auth.ts"
git commit -m "Carry role through the session/JWT, and share auth callbacks between the edge and full NextAuth instances"
```

---

## Task 4: `role` option on `withApiGuard`

**Files:**
- Modify: `src/libs/api-guard.ts`
- Modify: `src/libs/api-guard.test.ts`

**Interfaces:**
- Consumes: `hasRole`, `RoleName` (Task 1); `session.user.role` (Task 3).
- Produces: `withApiGuard(handler, { role: RoleName })` — rejects with 403 when the session's role ranks below `role`; implies `auth: true`.

- [ ] **Step 1: Write the failing tests**

Add to `src/libs/api-guard.test.ts` (existing file — add these `it` blocks inside the existing `describe("withApiGuard", ...)`):

```ts
    it("returns 403 when the session role is below the required minimum", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        const handler = vi.fn();
        const guarded = withApiGuard(handler, { role: "moderator" });

        const response = await guarded(makeRequest(), {});

        expect(response.status).toBe(403);
        expect(handler).not.toHaveBeenCalled();
        const body = await response.json();
        expect(body).toEqual({ data: null, message: "Forbidden" });
    });

    it("calls the handler when the session role meets the required minimum", async () => {
        const session = { user: { id: "u1", role: "admin" } };
        authMock.mockResolvedValue(session);
        const handler = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
        const guarded = withApiGuard(handler, { role: "moderator" });

        await guarded(makeRequest(), {});

        expect(handler).toHaveBeenCalledWith(expect.anything(), { session });
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/libs/api-guard.test.ts`
Expected: FAIL — role option not implemented, both new tests fail (403 test gets a 200/handler-called instead; second test also fails on the unimplemented option, or both fail on the missing `role` type if TS errors surface first).

- [ ] **Step 3: Implement**

```ts
// src/libs/api-guard.ts
import { cache } from "react";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/app/api/auth/[...nextauth]/auth";
import { hasRole, type RoleName } from "@/libs/roles";

// Memoized per request/render pass, per Next.js's recommended Data Access Layer pattern:
// https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal
export const getSession = cache(auth);

// Also the trusted session type for pages matched in proxy.ts's `config.matcher`,
// which guarantees a session is present before they render.
export type AuthenticatedSession = Session & { user: NonNullable<Session["user"]> & { id: string } };

interface ApiGuardOptions {
    /** Require a logged-in session; unauthenticated requests get a 401 before the handler runs. Defaults to true. */
    auth?: boolean;
    /** Minimum role required; implies `auth`. Requests below this rank get a 403 before the handler runs. */
    role?: RoleName;
}

/**
 * Wraps a Route Handler with cross-cutting API concerns, declared via one
 * options object instead of nested wrapper calls. This is the one place
 * that enforces those concerns -- add new ones as new `ApiGuardOptions`
 * keys and check them here; route files only ever change their options,
 * never their own security logic. `auth` defaults to true, so most routes
 * need no options at all:
 *
 *   export const POST = withApiGuard(async (request, { session }) => { ... });
 *   export const GET = withApiGuard(async (request) => { ... }, { auth: false }); // public route
 *   export const PATCH = withApiGuard(async (request, { session }) => { ... }, { role: "moderator" });
 *
 * Next.js's own docs endorse wrapping Route Handlers this way ("factory" pattern):
 * https://nextjs.org/docs/app/guides/backend-for-frontend#library-patterns
 */
export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: Context & { session: AuthenticatedSession }) => Promise<Response> | Response,
    options: { auth?: true; role: RoleName }
): (request: NextRequest, context: Context) => Promise<Response>;

export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: Context & { session: AuthenticatedSession }) => Promise<Response> | Response,
    options?: { auth?: true }
): (request: NextRequest, context: Context) => Promise<Response>;

export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: Context) => Promise<Response> | Response,
    options: { auth: false }
): (request: NextRequest, context: Context) => Promise<Response>;

export function withApiGuard<Context = unknown>(
    handler: (request: NextRequest, context: any) => Promise<Response> | Response,
    options: ApiGuardOptions = {}
) {
    const requireAuth = options.auth ?? true;
    return async (request: NextRequest, context: Context) => {
        if (requireAuth) {
            const session = await getSession();
            if (!session?.user?.id) {
                return NextResponse.json({ data: null, message: "Unauthorized" }, { status: 401 });
            }
            if (options.role && !hasRole(session.user.role, options.role)) {
                return NextResponse.json({ data: null, message: "Forbidden" }, { status: 403 });
            }
            return handler(request, { ...context, session: session as AuthenticatedSession });
        }
        return handler(request, context);
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/libs/api-guard.test.ts`
Expected: PASS (all tests, old and new).

- [ ] **Step 5: Commit**

```bash
git add src/libs/api-guard.ts src/libs/api-guard.test.ts
git commit -m "Add a minimum-role option to withApiGuard for role-gated routes"
```

---

## Task 5: Role-based route gating in `proxy.ts`

**Files:**
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: `hasRole`, `RoleName` (Task 1); edge session with `role` populated (Task 3).

- [ ] **Step 1: Implement**

```ts
// src/proxy.ts
import authConfig from "./auth.config";
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { hasRole, type RoleName } from "@/libs/roles";

const { auth } = NextAuth(authConfig);

// Path prefixes needing more than "just logged in". Ownership-based checks (e.g. can
// this user edit *this* post) need a DB read and stay at the page/route level instead —
// this list is only for checks resolvable from the role already in the session.
const ROLE_REQUIREMENTS: { prefix: string; minimum: RoleName }[] = [
    { prefix: "/posts/add", minimum: "author" },
    { prefix: "/dashboard/admin/users", minimum: "admin" },
    { prefix: "/dashboard/admin/categories", minimum: "admin" },
    { prefix: "/dashboard/admin/requests", minimum: "admin" },
    { prefix: "/dashboard/admin/posts", minimum: "moderator" },
    { prefix: "/dashboard/admin/comments", minimum: "moderator" },
];

export default auth((req) => {
    if (!req.auth) {
        const loginUrl = new URL("/auth/login", req.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }

    const requirement = ROLE_REQUIREMENTS.find((r) => req.nextUrl.pathname.startsWith(r.prefix));
    if (requirement && !hasRole(req.auth.user.role, requirement.minimum)) {
        return NextResponse.redirect(new URL("/dashboard/posts", req.nextUrl.origin));
    }
});

export const config = {
    matcher: ["/posts/add", "/posts/:slug/edit", "/dashboard/:path*"],
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification**

This task has no existing test file to extend (`proxy.ts` has no unit tests today — edge middleware isn't covered by this repo's test setup) and edge middleware is impractical to unit test here, so verify live instead: start the dev server, log in as an account whose role you can control (or wait until Task 6 seeds role-varied demo accounts, and come back to re-verify this step then), and confirm that visiting `/posts/add` as a Reader redirects to `/dashboard/posts` instead of the add-post form. Kill the dev server afterward if you started it.

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts
git commit -m "Gate author/moderator/admin-only routes by role at the edge"
```

---

## Task 6: Role migration for existing accounts

**Files:**
- Modify: `src/seeds/users.json`
- Modify: `src/seeds/seeder.ts`

**Interfaces:**
- Consumes: nothing new. Produces: every demo account has an explicit `role`; the real `sunil@gmail.com` account is promoted to `admin`.

- [ ] **Step 1: Add `role` to each demo user fixture**

In `src/seeds/users.json`, add a `"role"` field to each of the five entries — deliberately spread across all four tiers so every role is testable without touching a real account:

```json
[
  { "username": "ada.lovelace", "role": "author", "firstName": "Ada", "lastName": "Lovelace", "email": "ada@example.com", "intro": "Mathematician turned software person.", "profile": "Writes about the history and theory of computing when not arguing on the internet." },
  { "username": "alan.turing", "role": "reader", "firstName": "Alan", "lastName": "Turing", "email": "alan@example.com", "intro": "Breaks things to see how they work.", "profile": "Interested in machine intelligence, cryptography, and long walks." },
  { "username": "grace.hopper", "role": "admin", "firstName": "Grace", "lastName": "Hopper", "email": "grace@example.com", "intro": "Compiler enthusiast.", "profile": "Believes most bugs are just undocumented features waiting to be found." },
  { "username": "linus.t", "role": "moderator", "firstName": "Linus", "lastName": "T.", "email": "linus@example.com", "intro": "Opinionated about tabs vs. spaces.", "profile": "Reads every changelog. Comments on maybe a third of them." },
  { "username": "margaret.h", "role": "author", "firstName": "Margaret", "lastName": "H.", "email": "margaret@example.com", "intro": "Systems thinker.", "profile": "Cares more about reliability than features. Always asks about the failure modes." }
]
```

(Keep the existing key ordering/values for every other field — only `role` is new.)

- [ ] **Step 2: Backfill role on already-existing demo accounts**

In `src/seeds/seeder.ts`, update `seedDemoUsers()` so a re-run also fixes the role on accounts that already exist (today it only logs "exists" and does nothing further):

```ts
async function seedDemoUsers(): Promise<UserDoc[]> {
    const users: UserDoc[] = [];
    for (const raw of usersData) {
        let user = await User.findOne({ $or: [{ username: raw.username }, { email: raw.email }] });
        if (!user) {
            user = await User.create({ ...raw, password: hashSync(DEMO_PASSWORD, 10) });
            console.log(`👤 Demo user created: ${raw.username}`);
        } else {
            if (user.role !== raw.role) {
                user.role = raw.role;
                await user.save();
            }
            console.log(`👤 Demo user exists: ${raw.username}`);
        }
        users.push(user);
    }
    return users;
}
```

- [ ] **Step 3: Run the seeder**

Run: `npm run seed`
Expected: no errors; demo users log as "exists" (they were seeded in an earlier session) and are silently updated to their new role.

- [ ] **Step 4: Promote the real account**

This is a one-time fix for a single real document, not seed fixture data, so it doesn't belong in `seeder.ts` — run it directly, the same way the post-ownership reassignment earlier in this project's history was done (raw `MongoClient`, not `dbConnect()`, per this repo's centralized-connection rule):

```bash
node --env-file=.env -e "
const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const result = await db.collection('users').updateOne({ email: 'sunil@gmail.com' }, { \$set: { role: 'admin' } });
  console.log('sunil@gmail.com -> admin:', result.modifiedCount, 'modified');
  await client.close();
})();
"
```

- [ ] **Step 5: Verify**

```bash
node --env-file=.env -e "
const { MongoClient } = require('mongodb');
(async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const users = await db.collection('users').find({}, { projection: { email: 1, role: 1 } }).toArray();
  console.log(users);
  await client.close();
})();
"
```
Expected: `sunil@gmail.com` shows `role: "admin"`; the five demo accounts show the roles set in Step 1; every other pre-existing account (e.g. `annu`, `phase5tester`) shows no `role` field in the raw document — that's fine, they read as Reader via the schema default the moment they're fetched through Mongoose (not through this raw driver query, which bypasses schema defaults and shows the raw stored document).

- [ ] **Step 6: Commit**

```bash
git add src/seeds/users.json src/seeds/seeder.ts
git commit -m "Give demo accounts a role spread across all four tiers, and backfill roles on re-seed"
```

---

## Task 7: Post-approval route

**Files:**
- Create: `src/app/api/posts/[slug]/approval/route.ts`
- Test: `src/app/api/posts/[slug]/approval/route.test.ts`

**Interfaces:**
- Consumes: `withApiGuard` with `{ role: "moderator" }` (Task 4); `ApprovalStatus` from `@/models/Post`.
- Produces: `PATCH /api/posts/:slug/approval` with JSON body `{ approval: "Approved" | "Rejected" }`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/posts/[slug]/approval/route.test.ts
import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "mod1", role: "moderator" } }),
}));

const findOneAndUpdateMock = vi.fn();
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: { findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args) },
    };
});

const { PATCH } = await import("@/app/api/posts/[slug]/approval/route");

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/posts/some-slug/approval", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

function context(slug: string) {
    return { params: Promise.resolve({ slug }) };
}

describe("PATCH /api/posts/[slug]/approval", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
    });

    it("rejects a body with an invalid approval value", async () => {
        const response = await PATCH(requestWithBody({ approval: "Deleted" }), context("some-slug"));

        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("returns 404 when the post doesn't exist", async () => {
        findOneAndUpdateMock.mockResolvedValue(null);
        const response = await PATCH(requestWithBody({ approval: "Approved" }), context("missing-slug"));

        expect(response.status).toBe(404);
    });

    it("approves a post and stamps approvedAt", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug", approval: "Approved" });
        const response = await PATCH(requestWithBody({ approval: "Approved" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug" },
            expect.objectContaining({ approval: "Approved", approvedAt: expect.any(Date) }),
            { new: true }
        );
    });

    it("rejects a post and clears approvedAt", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug", approval: "Rejected" });
        const response = await PATCH(requestWithBody({ approval: "Rejected" }), context("some-slug"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug" },
            expect.objectContaining({ approval: "Rejected", approvedAt: null }),
            { new: true }
        );
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/posts/[slug]/approval/route.test.ts`
Expected: FAIL — route module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// src/app/api/posts/[slug]/approval/route.ts
import { NextResponse } from "next/server";
import Post, { ApprovalStatus } from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";

interface RouteContext {
    params: Promise<{ slug: string }>;
}

export const PATCH = withApiGuard<RouteContext>(
    async (request, { params }) => {
        try {
            const { slug } = await params;
            const body = await request.json().catch(() => null);
            const approval = body?.approval;

            if (approval !== ApprovalStatus.Approved && approval !== ApprovalStatus.Rejected) {
                return NextResponse.json({ data: null, message: "approval must be Approved or Rejected" }, { status: 400 });
            }

            const post = await Post.findOneAndUpdate(
                { slug },
                { approval, approvedAt: approval === ApprovalStatus.Approved ? new Date() : null },
                { new: true }
            );

            if (!post) {
                return NextResponse.json({ data: null, message: "Post not found" }, { status: 404 });
            }

            return NextResponse.json({ data: { slug: post.slug, approval: post.approval }, message: "Success" });
        } catch (error) {
            console.error("Failed to update post approval:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "moderator" }
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/posts/[slug]/approval/route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/posts/[slug]/approval/route.ts" "src/app/api/posts/[slug]/approval/route.test.ts"
git commit -m "Add a moderator-only route for approving or rejecting any post"
```

---

## Task 8: Cross-user review queue page

**Files:**
- Create: `src/app/dashboard/admin/posts/page.tsx`
- Create: `src/components/dashboard/admin/PostApprovalActions.tsx`

**Interfaces:**
- Consumes: `PATCH /api/posts/:slug/approval` (Task 7).

- [ ] **Step 1: Implement the approve/reject client component**

```tsx
// src/components/dashboard/admin/PostApprovalActions.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface PostApprovalActionsProps {
    slug: string;
}

export default function PostApprovalActions({ slug }: PostApprovalActionsProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const setApproval = (approval: "Approved" | "Rejected") => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/posts/${slug}/approval`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ approval }),
                });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to update approval.");
                    return;
                }
                toast.success(approval === "Approved" ? "Post approved." : "Post rejected.");
                router.refresh();
            } catch {
                toast.error("Failed to update approval.");
            }
        });
    };

    return (
        <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setApproval("Approved")} disabled={pending}>
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
                <span className="sr-only">Approve post</span>
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setApproval("Rejected")} disabled={pending}>
                <XCircle className="text-destructive" />
                <span className="sr-only">Reject post</span>
            </Button>
        </div>
    );
}
```

- [ ] **Step 2: Implement the page**

```tsx
// src/app/dashboard/admin/posts/page.tsx
import Link from "next/link";
import { FilterQuery } from "mongoose";
import Post, { IPost, ApprovalStatus } from "@/models/Post";
import User from "@/models/User";
import Category from "@/models/Category";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PostApprovalActions from "@/components/dashboard/admin/PostApprovalActions";

const PAGE_SIZE = 10;
const APPROVAL_OPTIONS = Object.values(ApprovalStatus);

const APPROVAL_STYLES: Record<string, string> = {
    Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Rejected: "bg-destructive/10 text-destructive",
    Inactive: "bg-muted text-muted-foreground",
};

interface AdminPostsPageProps {
    searchParams: Promise<{ approval?: string }>;
}

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
    const { approval: approvalParam } = await searchParams;
    const approval = APPROVAL_OPTIONS.includes(approvalParam as ApprovalStatus) ? (approvalParam as ApprovalStatus) : ApprovalStatus.Pending;

    const filter: FilterQuery<IPost> = { approval };

    const posts = await Post.find(filter)
        .populate({ path: "userId", model: User, select: "email username" })
        .populate({ path: "categoryId", model: Category, select: "title" })
        .sort({ createdAt: -1 })
        .limit(PAGE_SIZE)
        .lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Review Queue</h1>
            <p className="mt-2 text-muted-foreground">Posts from every author, filtered by approval status.</p>

            <div className="mt-4 flex flex-wrap gap-2">
                {APPROVAL_OPTIONS.map((option) => (
                    <Link key={option} href={`/dashboard/admin/posts?approval=${option}`}>
                        <Badge variant={option === approval ? "default" : "outline"} className="cursor-pointer">
                            {option}
                        </Badge>
                    </Link>
                ))}
            </div>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Author</TableHead>
                            <TableHead>Approval</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {posts.map((post) => {
                            const author = post.userId as unknown as { email?: string; username?: string } | null;
                            const category = post.categoryId as unknown as { title?: string } | null;
                            return (
                                <TableRow key={String(post._id)}>
                                    <TableCell className="font-medium">
                                        <Link href={`/posts/${post.slug}`} className="text-primary hover:underline">
                                            {post.title || "—"}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{category?.title || "—"}</TableCell>
                                    <TableCell>{author?.email || author?.username || "—"}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={APPROVAL_STYLES[post.approval] || ""}>
                                            {post.approval}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <PostApprovalActions slug={post.slug} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {posts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    No {approval.toLowerCase()} posts.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification**

Log in as `linus@example.com` (Moderator, password `Passw0rd!`), visit `/dashboard/admin/posts`, confirm the Pending filter shows posts regardless of owner, and that Approve/Reject actually change a post's status (`router.refresh()` should update the row, or the post should drop out of the Pending filter after approving).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/admin/posts/page.tsx src/components/dashboard/admin/PostApprovalActions.tsx
git commit -m "Add the cross-user post review queue"
```

---

## Task 9: Comment moderation route

**Files:**
- Modify: `src/app/api/comments/[id]/route.ts`
- Create: `src/app/api/comments/[id]/route.test.ts`

**Interfaces:**
- Consumes: `hasRole` (Task 1); `session.user.role` (Task 3).
- Produces: `DELETE /api/comments/:id` now also succeeds for Moderator+ on a comment they don't own (unchanged for everyone else: owner-only).

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/comments/[id]/route.test.ts
import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOneMock = vi.fn();
vi.mock("@/models/Comment", () => ({
    default: { findOne: (...args: unknown[]) => findOneMock(...args) },
}));

const updateOneMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/models/Post", () => ({
    default: { updateOne: (...args: unknown[]) => updateOneMock(...args) },
}));

const { DELETE } = await import("@/app/api/comments/[id]/route");

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}

function makeComment(overrides: Partial<{ userId: string; postId: string }> = {}) {
    return {
        userId: overrides.userId ?? "owner1",
        postId: overrides.postId ?? "post1",
        delete: vi.fn().mockResolvedValue(undefined),
    };
}

describe("DELETE /api/comments/[id]", () => {
    beforeEach(() => {
        findOneMock.mockReset();
        updateOneMock.mockClear();
    });

    it("lets the owner delete their own comment", async () => {
        authMock.mockResolvedValue({ user: { id: "owner1", role: "reader" } });
        const comment = makeComment({ userId: "owner1" });
        findOneMock.mockResolvedValue(comment);

        const response = await DELETE(new NextRequest("http://localhost/api/comments/c1", { method: "DELETE" }), context("c1"));

        expect(response.status).toBe(200);
        expect(findOneMock).toHaveBeenCalledWith({ _id: "c1", userId: "owner1" });
        expect(comment.delete).toHaveBeenCalledWith("owner1");
    });

    it("blocks a non-owner, non-moderator from deleting someone else's comment", async () => {
        authMock.mockResolvedValue({ user: { id: "other1", role: "author" } });
        findOneMock.mockResolvedValue(null); // scoped filter excludes it, so lookup returns nothing

        const response = await DELETE(new NextRequest("http://localhost/api/comments/c1", { method: "DELETE" }), context("c1"));

        expect(response.status).toBe(404);
        expect(findOneMock).toHaveBeenCalledWith({ _id: "c1", userId: "other1" });
    });

    it("lets a moderator delete a comment they don't own", async () => {
        authMock.mockResolvedValue({ user: { id: "mod1", role: "moderator" } });
        const comment = makeComment({ userId: "owner1" });
        findOneMock.mockResolvedValue(comment);

        const response = await DELETE(new NextRequest("http://localhost/api/comments/c1", { method: "DELETE" }), context("c1"));

        expect(response.status).toBe(200);
        expect(findOneMock).toHaveBeenCalledWith({ _id: "c1" });
        expect(comment.delete).toHaveBeenCalledWith("mod1");
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/comments/[id]/route.test.ts`
Expected: the moderator test FAILs (current code always scopes by `userId`, so `findOneMock` gets called with `{ _id: "c1", userId: "mod1" }` instead of `{ _id: "c1" }`).

- [ ] **Step 3: Implement the override**

In `src/app/api/comments/[id]/route.ts`, add the import and update `DELETE`'s lookup filter (the `PATCH` handler for editing a comment's own text is unchanged — moderators remove comments, they don't rewrite them, per the spec):

```ts
import { hasRole } from "@/libs/roles";
```

```ts
export const DELETE = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { id } = await params;
        const filter = hasRole(session.user.role, "moderator") ? { _id: id } : { _id: id, userId: session.user.id };

        const comment = await Comment.findOne(filter);
        if (!comment) {
            return NextResponse.json({ data: null, message: "Comment not found" }, { status: 404 });
        }

        await comment.delete(session.user.id);
        await Post.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });

        return NextResponse.json({ data: null, message: "Success" });
    } catch (error) {
        console.error("Failed to delete comment:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/comments/[id]/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/comments/[id]/route.ts" "src/app/api/comments/[id]/route.test.ts"
git commit -m "Let moderators delete any comment, not just their own"
```

---

## Task 10: Comment moderation page

**Files:**
- Create: `src/app/dashboard/admin/comments/page.tsx`
- Create: `src/components/dashboard/admin/RemoveCommentButton.tsx`

**Interfaces:**
- Consumes: `DELETE /api/comments/:id` (Task 9, now moderator-aware).

- [ ] **Step 1: Implement the remove button**

```tsx
// src/components/dashboard/admin/RemoveCommentButton.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function RemoveCommentButton({ id }: { id: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const handleRemove = () => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/comments/${id}`, { method: "DELETE" });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to remove comment.");
                    return;
                }
                toast.success("Comment removed.");
                router.refresh();
            } catch {
                toast.error("Failed to remove comment.");
            }
        });
    };

    return (
        <Button variant="ghost" size="icon-sm" onClick={handleRemove} disabled={pending}>
            <Trash2 />
            <span className="sr-only">Remove comment</span>
        </Button>
    );
}
```

- [ ] **Step 2: Implement the page**

```tsx
// src/app/dashboard/admin/comments/page.tsx
import Link from "next/link";
import Comment from "@/models/Comment";
import User from "@/models/User";
import Post from "@/models/Post";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RemoveCommentButton from "@/components/dashboard/admin/RemoveCommentButton";

const PAGE_SIZE = 20;

export default async function AdminCommentsPage() {
    const comments = await Comment.find({})
        .populate({ path: "userId", model: User, select: "email username" })
        .populate({ path: "postId", model: Post, select: "title slug" })
        .sort({ createdAt: -1 })
        .limit(PAGE_SIZE)
        .lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Comment Moderation</h1>
            <p className="mt-2 text-muted-foreground">The most recent comments across every post.</p>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Comment</TableHead>
                            <TableHead>Author</TableHead>
                            <TableHead>Post</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {comments.map((comment) => {
                            const author = comment.userId as unknown as { email?: string; username?: string } | null;
                            const post = comment.postId as unknown as { title?: string; slug?: string } | null;
                            return (
                                <TableRow key={String(comment._id)}>
                                    <TableCell className="max-w-md truncate">{comment.content}</TableCell>
                                    <TableCell>{author?.email || author?.username || "—"}</TableCell>
                                    <TableCell>
                                        {post?.slug ? (
                                            <Link href={`/posts/${post.slug}`} className="text-primary hover:underline">
                                                {post.title}
                                            </Link>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <RemoveCommentButton id={String(comment._id)} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {comments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                                    No comments yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification**

Log in as `linus@example.com` (Moderator), visit `/dashboard/admin/comments`, confirm comments from every user/post show up (not just the moderator's own), and that removing one works and disappears after `router.refresh()`.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/admin/comments/page.tsx src/components/dashboard/admin/RemoveCommentButton.tsx
git commit -m "Add the comment moderation queue"
```

---

## Task 11: Admin override on post edit/delete

**Files:**
- Modify: `src/app/api/posts/[slug]/route.ts`
- Create: `src/app/api/posts/[slug]/route.test.ts`
- Modify: `src/app/posts/[slug]/edit/page.tsx`

**Interfaces:**
- Consumes: `hasRole` (Task 1).
- Produces: Admin can edit/delete any post; every other role stays owner-only (unchanged).

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/posts/[slug]/route.test.ts
import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOneAndUpdateMock = vi.fn();
const softDeleteMock = vi.fn();
vi.mock("@/models/Post", async () => {
    const actual = await vi.importActual<typeof import("@/models/Post")>("@/models/Post");
    return {
        ...actual,
        default: {
            findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args),
            delete: (...args: unknown[]) => softDeleteMock(...args),
        },
    };
});

vi.mock("@/libs/post-editor-serialize", () => ({
    parsePostEditorValue: () => ({ some: "value" }),
    serializePostContent: async () => "<p>content</p>",
}));

const { PATCH, DELETE } = await import("@/app/api/posts/[slug]/route");

function context(slug: string) {
    return { params: Promise.resolve({ slug }) };
}

function patchRequest(fields: Record<string, string>) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return new NextRequest("http://localhost/api/posts/some-slug", { method: "PATCH", body });
}

describe("PATCH /api/posts/[slug]", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "author1", role: "author" } });
    });

    it("scopes the update to the owner for a non-admin", async () => {
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug" });
        await PATCH(patchRequest({ title: "New title", post_data: "{}" }), context("some-slug"));

        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { slug: "some-slug", userId: "author1" },
            expect.anything(),
            { new: true }
        );
    });

    it("lets an admin update any post regardless of owner", async () => {
        authMock.mockResolvedValue({ user: { id: "admin1", role: "admin" } });
        findOneAndUpdateMock.mockResolvedValue({ slug: "some-slug" });
        await PATCH(patchRequest({ title: "New title", post_data: "{}" }), context("some-slug"));

        expect(findOneAndUpdateMock).toHaveBeenCalledWith({ slug: "some-slug" }, expect.anything(), { new: true });
    });
});

describe("DELETE /api/posts/[slug]", () => {
    beforeEach(() => {
        softDeleteMock.mockReset();
        authMock.mockResolvedValue({ user: { id: "author1", role: "author" } });
    });

    it("scopes the delete to the owner for a non-admin", async () => {
        softDeleteMock.mockResolvedValue({ matchedCount: 1 });
        await DELETE(new NextRequest("http://localhost/api/posts/some-slug", { method: "DELETE" }), context("some-slug"));

        expect(softDeleteMock).toHaveBeenCalledWith({ slug: "some-slug", userId: "author1" }, "author1");
    });

    it("lets an admin delete any post regardless of owner", async () => {
        authMock.mockResolvedValue({ user: { id: "admin1", role: "admin" } });
        softDeleteMock.mockResolvedValue({ matchedCount: 1 });
        await DELETE(new NextRequest("http://localhost/api/posts/some-slug", { method: "DELETE" }), context("some-slug"));

        expect(softDeleteMock).toHaveBeenCalledWith({ slug: "some-slug" }, "admin1");
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "src/app/api/posts/[slug]/route.test.ts"`
Expected: the two admin-override tests FAIL (current code always includes `userId` in the filter).

- [ ] **Step 3: Implement the override in the route**

In `src/app/api/posts/[slug]/route.ts`, add the import and change both handlers' ownership filter:

```ts
import { hasRole } from "@/libs/roles";
```

```ts
export const PATCH = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { slug: currentSlug } = await params;
        if (!currentSlug) {
            return NextResponse.json({ data: null, message: 'Slug is required' }, { status: 400 });
        }

        const body = await request.formData();

        const title = (body.get('title') as string || '').trim();
        if (!title) {
            return NextResponse.json({ data: null, message: 'Title is required' }, { status: 400 });
        }

        const nextSlug = ((body.get('slug') as string) || '').trim() || slugify(title);
        if (!nextSlug) {
            return NextResponse.json({ data: null, message: 'Slug is required' }, { status: 400 });
        }

        const value = parsePostEditorValue(body.get('post_data'));
        if (!value) {
            return NextResponse.json({ data: null, message: 'Post content is required' }, { status: 400 });
        }

        const isAdmin = hasRole(session.user.role, "admin");
        const post = await Post.findOneAndUpdate(
            isAdmin ? { slug: currentSlug } : { slug: currentSlug, userId: session.user.id },
            {
                slug: nextSlug,
                title,
                titleDescription: body.get('titleDescription'),
                tags: (body.get('tags') as string)?.split(',').filter(Boolean) ?? [],
                bannerImage: body.get('postBannerPath'),
                content: await serializePostContent(value),
            },
            { new: true }
        );

        if (!post) {
            return NextResponse.json({ data: null, message: 'Post not found' }, { status: 404 });
        }

        return NextResponse.json({ data: { slug: post.slug }, message: 'Success' });
    } catch (error) {
        if ((error as { code?: number }).code === 11000) {
            return NextResponse.json({ data: null, message: 'A post with this slug already exists. Please choose a different slug.' }, { status: 409 });
        }
        console.error('Failed to update post:', error);
        return NextResponse.json({ data: null, message: 'Something went wrong' }, { status: 500 });
    }
});

export const DELETE = withApiGuard<RouteContext>(async (request, { params, session }) => {
    try {
        const { slug } = await params;
        if (!slug) {
            return NextResponse.json({ data: null, message: 'Slug is required' }, { status: 400 });
        }

        const isAdmin = hasRole(session.user.role, "admin");

        // mongoose-delete's types claim a DeleteResult, but `.delete()` actually runs an
        // `updateMany` under the hood (it flips `deleted: true` rather than removing the doc).
        const result = (await SoftDeletePost.delete(
            isAdmin ? { slug } : { slug, userId: session.user.id },
            session.user.id
        )) as unknown as { matchedCount: number };
        if (result.matchedCount === 0) {
            return NextResponse.json({ data: null, message: 'Post not found' }, { status: 404 });
        }

        return NextResponse.json({ data: null, message: 'Success' });
    } catch (error) {
        console.error('Failed to delete post:', error);
        return NextResponse.json({ data: null, message: 'Something went wrong' }, { status: 500 });
    }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/api/posts/[slug]/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Extend the edit page for the same override**

In `src/app/posts/[slug]/edit/page.tsx`, replace the owner-only lookup:

```tsx
import { hasRole } from "@/libs/roles";
```

```tsx
export default async function EditPostPage({ params }: EditPostPageProps) {
    const { slug } = await params;
    // proxy.ts's matcher redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const isAdmin = hasRole(session.user.role, "admin");
    const post = await Post.findOne(isAdmin ? { slug } : { slug, userId: session.user.id }).lean();
    if (!post) notFound();
    // ...unchanged from here
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Manual verification**

Log in as `grace@example.com` (Admin), open the edit page for a post owned by `ada@example.com` directly (`/posts/<their-slug>/edit`), confirm it loads instead of 404ing, and that saving/deleting it works.

- [ ] **Step 8: Commit**

```bash
git add "src/app/api/posts/[slug]/route.ts" "src/app/api/posts/[slug]/route.test.ts" "src/app/posts/[slug]/edit/page.tsx"
git commit -m "Let admins edit or delete any post, not just their own"
```

---

## Task 12: `PublishRequest` model

**Files:**
- Create: `src/models/PublishRequest.ts`

**Interfaces:**
- Produces: `IPublishRequest` (`userId`, `status: "Pending"|"Approved"|"Rejected"`, `reviewedBy?`, `reviewedAt?`, timestamps), default-exported `PublishRequest` Mongoose model.

No soft-delete plugin here — unlike `Post`/`Comment`/`Category`, this is a small workflow record, not user content, so it doesn't need a trash/audit trail; a straightforward hard document is enough.

- [ ] **Step 1: Implement**

```ts
// src/models/PublishRequest.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type PublishRequestStatus = "Pending" | "Approved" | "Rejected";

export interface IPublishRequest extends Document {
    userId: Types.ObjectId;
    status: PublishRequestStatus;
    reviewedBy: Types.ObjectId | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const schema = new Schema<IPublishRequest>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);

schema.index({ userId: 1, status: 1 });

const PublishRequest = mongoose.models?.PublishRequest || mongoose.model<IPublishRequest>("PublishRequest", schema, "publishrequests");
export default PublishRequest;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/models/PublishRequest.ts
git commit -m "Add the PublishRequest model backing the Reader-to-Author request flow"
```

---

## Task 13: Submit a publish request

**Files:**
- Create: `src/app/api/publish-requests/route.ts`
- Test: `src/app/api/publish-requests/route.test.ts`

**Interfaces:**
- Consumes: `PublishRequest` (Task 12).
- Produces: `POST /api/publish-requests` — 400 if the caller isn't a Reader or already has a Pending request; otherwise creates one.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/publish-requests/route.test.ts
import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({ auth: authMock }));

const findOneMock = vi.fn();
const createMock = vi.fn();
vi.mock("@/models/PublishRequest", () => ({
    default: {
        findOne: (...args: unknown[]) => findOneMock(...args),
        create: (...args: unknown[]) => createMock(...args),
    },
}));

const { POST } = await import("@/app/api/publish-requests/route");

function request() {
    return new NextRequest("http://localhost/api/publish-requests", { method: "POST" });
}

describe("POST /api/publish-requests", () => {
    beforeEach(() => {
        findOneMock.mockReset();
        createMock.mockReset();
    });

    it("rejects a caller who isn't a Reader", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "author" } });

        const response = await POST(request(), {});

        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("rejects a Reader who already has a pending request", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        findOneMock.mockResolvedValue({ _id: "existing" });

        const response = await POST(request(), {});

        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("creates a request for a Reader with no pending request", async () => {
        authMock.mockResolvedValue({ user: { id: "u1", role: "reader" } });
        findOneMock.mockResolvedValue(null);
        createMock.mockResolvedValue({ _id: "new1" });

        const response = await POST(request(), {});

        expect(response.status).toBe(200);
        expect(createMock).toHaveBeenCalledWith({ userId: "u1" });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/publish-requests/route.test.ts`
Expected: FAIL — route module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// src/app/api/publish-requests/route.ts
import { NextResponse } from "next/server";
import PublishRequest from "@/models/PublishRequest";
import { withApiGuard } from "@/libs/api-guard";

export const POST = withApiGuard(async (request, { session }) => {
    try {
        if (session.user.role !== "reader") {
            return NextResponse.json({ data: null, message: "Only Readers can request to publish" }, { status: 400 });
        }

        const existing = await PublishRequest.findOne({ userId: session.user.id, status: "Pending" });
        if (existing) {
            return NextResponse.json({ data: null, message: "You already have a pending request" }, { status: 400 });
        }

        const publishRequest = await PublishRequest.create({ userId: session.user.id });
        return NextResponse.json({ data: { id: publishRequest._id.toString() }, message: "Success" });
    } catch (error) {
        console.error("Failed to create publish request:", error);
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/publish-requests/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/publish-requests/route.ts src/app/api/publish-requests/route.test.ts
git commit -m "Let Readers submit a request to become an Author"
```

---

## Task 14: Review a publish request

**Files:**
- Create: `src/app/api/publish-requests/[id]/route.ts`
- Test: `src/app/api/publish-requests/[id]/route.test.ts`

**Interfaces:**
- Consumes: `PublishRequest` (Task 12); `withApiGuard` with `{ role: "admin" }` (Task 4).
- Produces: `PATCH /api/publish-requests/:id` with JSON body `{ action: "approve" | "reject" }`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/publish-requests/[id]/route.test.ts
import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const findOneAndUpdateMock = vi.fn();
vi.mock("@/models/PublishRequest", () => ({
    default: { findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args) },
}));

const updateOneMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/models/User", () => ({
    default: { updateOne: (...args: unknown[]) => updateOneMock(...args) },
}));

const { PATCH } = await import("@/app/api/publish-requests/[id]/route");

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/publish-requests/r1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/publish-requests/[id]", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
        updateOneMock.mockClear();
    });

    it("rejects an invalid action", async () => {
        const response = await PATCH(requestWithBody({ action: "delete" }), context("r1"));
        expect(response.status).toBe(400);
    });

    it("returns 404 when there's no matching pending request", async () => {
        findOneAndUpdateMock.mockResolvedValue(null);
        const response = await PATCH(requestWithBody({ action: "approve" }), context("r1"));
        expect(response.status).toBe(404);
    });

    it("approving sets the requester's role to author", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "r1", userId: "reader1", status: "Approved" });
        const response = await PATCH(requestWithBody({ action: "approve" }), context("r1"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith(
            { _id: "r1", status: "Pending" },
            expect.objectContaining({ status: "Approved", reviewedBy: "admin1", reviewedAt: expect.any(Date) }),
            { new: true }
        );
        expect(updateOneMock).toHaveBeenCalledWith({ _id: "reader1" }, { role: "author" });
    });

    it("rejecting doesn't change the requester's role", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "r1", userId: "reader1", status: "Rejected" });
        const response = await PATCH(requestWithBody({ action: "reject" }), context("r1"));

        expect(response.status).toBe(200);
        expect(updateOneMock).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "src/app/api/publish-requests/[id]/route.test.ts"`
Expected: FAIL — route module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// src/app/api/publish-requests/[id]/route.ts
import { NextResponse } from "next/server";
import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(
    async (request, { params, session }) => {
        try {
            const { id } = await params;
            const body = await request.json().catch(() => null);
            const action = body?.action;

            if (action !== "approve" && action !== "reject") {
                return NextResponse.json({ data: null, message: "action must be approve or reject" }, { status: 400 });
            }

            const status = action === "approve" ? "Approved" : "Rejected";
            const publishRequest = await PublishRequest.findOneAndUpdate(
                { _id: id, status: "Pending" },
                { status, reviewedBy: session.user.id, reviewedAt: new Date() },
                { new: true }
            );

            if (!publishRequest) {
                return NextResponse.json({ data: null, message: "Request not found" }, { status: 404 });
            }

            if (action === "approve") {
                await User.updateOne({ _id: publishRequest.userId }, { role: "author" });
            }

            return NextResponse.json({ data: { id: publishRequest._id.toString(), status }, message: "Success" });
        } catch (error) {
            console.error("Failed to review publish request:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "admin" }
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/api/publish-requests/[id]/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/publish-requests/[id]/route.ts "src/app/api/publish-requests/[id]/route.test.ts"
git commit -m "Add admin approval/rejection for publish requests, promoting the requester on approval"
```

---

## Task 15: Publish request queue page + Reader CTA

**Files:**
- Create: `src/app/dashboard/admin/requests/page.tsx`
- Create: `src/components/dashboard/admin/PublishRequestActions.tsx`
- Create: `src/components/dashboard/RequestPublishButton.tsx`
- Modify: `src/app/dashboard/posts/page.tsx`

**Interfaces:**
- Consumes: `POST /api/publish-requests` (Task 13), `PATCH /api/publish-requests/:id` (Task 14).

- [ ] **Step 1: Implement the admin approve/reject component**

```tsx
// src/components/dashboard/admin/PublishRequestActions.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function PublishRequestActions({ id }: { id: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const review = (action: "approve" | "reject") => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/publish-requests/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action }),
                });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to review request.");
                    return;
                }
                toast.success(action === "approve" ? "Request approved — user is now an Author." : "Request rejected.");
                router.refresh();
            } catch {
                toast.error("Failed to review request.");
            }
        });
    };

    return (
        <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => review("approve")} disabled={pending}>
                <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" />
                <span className="sr-only">Approve request</span>
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => review("reject")} disabled={pending}>
                <XCircle className="text-destructive" />
                <span className="sr-only">Reject request</span>
            </Button>
        </div>
    );
}
```

- [ ] **Step 2: Implement the admin page**

```tsx
// src/app/dashboard/admin/requests/page.tsx
import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PublishRequestActions from "@/components/dashboard/admin/PublishRequestActions";

export default async function AdminRequestsPage() {
    const requests = await PublishRequest.find({ status: "Pending" })
        .populate({ path: "userId", model: User, select: "email username" })
        .sort({ createdAt: 1 })
        .lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Publish Requests</h1>
            <p className="mt-2 text-muted-foreground">Readers asking to become Authors.</p>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>User</TableHead>
                            <TableHead>Requested</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map((req) => {
                            const requester = req.userId as unknown as { email?: string; username?: string } | null;
                            return (
                                <TableRow key={String(req._id)}>
                                    <TableCell>{requester?.email || requester?.username || "—"}</TableCell>
                                    <TableCell className="font-mono text-xs">{new Date(req.createdAt).toLocaleDateString("en-US")}</TableCell>
                                    <TableCell className="text-right">
                                        <PublishRequestActions id={String(req._id)} />
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {requests.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="h-32 text-center text-muted-foreground">
                                    No pending requests.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Implement the Reader-facing request button**

```tsx
// src/components/dashboard/RequestPublishButton.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function RequestPublishButton() {
    const [pending, startTransition] = useTransition();
    const [sent, setSent] = useState(false);

    const handleRequest = () => {
        startTransition(async () => {
            try {
                const response = await fetch("/api/publish-requests", { method: "POST" });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to send request.");
                    return;
                }
                toast.success("Request sent — an admin will review it.");
                setSent(true);
            } catch {
                toast.error("Failed to send request.");
            }
        });
    };

    if (sent) {
        return <p className="text-sm text-muted-foreground">Your request to publish is pending review.</p>;
    }

    return (
        <Button onClick={handleRequest} disabled={pending}>
            {pending ? "Sending…" : "Request to publish"}
        </Button>
    );
}
```

- [ ] **Step 4: Wire the button into the dashboard for Readers**

In `src/app/dashboard/posts/page.tsx`, replace the always-shown "Add Post" button with a role-conditional one. Add the import and change the header block:

```tsx
import { hasRole } from "@/libs/roles";
import RequestPublishButton from "@/components/dashboard/RequestPublishButton";
```

```tsx
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PostsSearch key={q || ""} defaultValue={q || ""} />
                {hasRole(session.user.role, "author") ? (
                    <Button asChild>
                        <Link href="/posts/add">Add Post</Link>
                    </Button>
                ) : (
                    <RequestPublishButton />
                )}
            </div>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Manual verification**

Log in as `alan@example.com` (Reader): visit `/dashboard/posts`, confirm "Request to publish" shows instead of "Add Post", click it, confirm the success state. Log in as `sunil@gmail.com` (Admin), visit `/dashboard/admin/requests`, confirm the request appears, approve it, then confirm `alan@example.com` can now see "Add Post" after logging back in (role changes apply on next sign-in, per the spec's documented limitation).

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/admin/requests/page.tsx src/components/dashboard/admin/PublishRequestActions.tsx src/components/dashboard/RequestPublishButton.tsx src/app/dashboard/posts/page.tsx
git commit -m "Add the publish-request review queue and the Reader-facing request button"
```

---

## Task 16: User role management route

**Files:**
- Create: `src/app/api/users/[id]/role/route.ts`
- Test: `src/app/api/users/[id]/role/route.test.ts`

**Interfaces:**
- Consumes: `withApiGuard` with `{ role: "admin" }` (Task 4).
- Produces: `PATCH /api/users/:id/role` with JSON body `{ role: RoleName }`; blocks an admin from changing their own role.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/users/[id]/role/route.test.ts
import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const findOneAndUpdateMock = vi.fn();
vi.mock("@/models/User", () => ({
    default: { findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args) },
}));

const { PATCH } = await import("@/app/api/users/[id]/role/route");

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/users/u1/role", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /api/users/[id]/role", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
    });

    it("rejects an invalid role value", async () => {
        const response = await PATCH(requestWithBody({ role: "superuser" }), context("u1"));
        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("blocks an admin from changing their own role", async () => {
        const response = await PATCH(requestWithBody({ role: "reader" }), context("admin1"));
        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("returns 404 when the target user doesn't exist", async () => {
        findOneAndUpdateMock.mockResolvedValue(null);
        const response = await PATCH(requestWithBody({ role: "moderator" }), context("missing"));
        expect(response.status).toBe(404);
    });

    it("updates the target user's role", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "u1", role: "moderator" });
        const response = await PATCH(requestWithBody({ role: "moderator" }), context("u1"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith({ _id: "u1" }, { role: "moderator" }, { new: true });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run "src/app/api/users/[id]/role/route.test.ts"`
Expected: FAIL — route module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// src/app/api/users/[id]/role/route.ts
import { NextResponse } from "next/server";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import { ROLE_RANK } from "@/libs/roles";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(
    async (request, { params, session }) => {
        try {
            const { id } = await params;
            const body = await request.json().catch(() => null);
            const role = body?.role;

            if (!Object.keys(ROLE_RANK).includes(role)) {
                return NextResponse.json({ data: null, message: "Invalid role" }, { status: 400 });
            }

            if (id === session.user.id) {
                return NextResponse.json({ data: null, message: "You can't change your own role" }, { status: 400 });
            }

            const user = await User.findOneAndUpdate({ _id: id }, { role }, { new: true });
            if (!user) {
                return NextResponse.json({ data: null, message: "User not found" }, { status: 404 });
            }

            return NextResponse.json({ data: { id: user._id.toString(), role: user.role }, message: "Success" });
        } catch (error) {
            console.error("Failed to update user role:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "admin" }
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run "src/app/api/users/[id]/role/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/users/[id]/role/route.ts "src/app/api/users/[id]/role/route.test.ts"
git commit -m "Add admin-only user role management"
```

---

## Task 17: User management page

**Files:**
- Create: `src/app/dashboard/admin/users/page.tsx`
- Create: `src/components/dashboard/admin/RoleSelect.tsx`

**Interfaces:**
- Consumes: `PATCH /api/users/:id/role` (Task 16).

- [ ] **Step 1: Implement the role picker**

```tsx
// src/components/dashboard/admin/RoleSelect.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { RoleName } from "@/libs/roles";

const ROLE_OPTIONS: RoleName[] = ["reader", "author", "moderator", "admin"];

interface RoleSelectProps {
    userId: string;
    currentRole: RoleName;
    disabled?: boolean;
}

export default function RoleSelect({ userId, currentRole, disabled }: RoleSelectProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const setRole = (role: string) => {
        if (role === currentRole) return;
        startTransition(async () => {
            try {
                const response = await fetch(`/api/users/${userId}/role`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ role }),
                });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to update role.");
                    return;
                }
                toast.success(`Role updated to ${role}.`);
                router.refresh();
            } catch {
                toast.error("Failed to update role.");
            }
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={disabled || pending} className="capitalize">
                    {currentRole} <ChevronDown className="size-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={currentRole} onValueChange={setRole}>
                    {ROLE_OPTIONS.map((role) => (
                        <DropdownMenuRadioItem key={role} value={role} className="capitalize">
                            {role}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

- [ ] **Step 2: Implement the page**

```tsx
// src/app/dashboard/admin/users/page.tsx
import User from "@/models/User";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RoleSelect from "@/components/dashboard/admin/RoleSelect";
import type { RoleName } from "@/libs/roles";

export default async function AdminUsersPage() {
    const session = (await getSession()) as AuthenticatedSession;
    const users = await User.find({}).select("username email role").sort({ createdAt: 1 }).lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Users</h1>
            <p className="mt-2 text-muted-foreground">Manage what every account can do.</p>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>User</TableHead>
                            <TableHead className="text-right">Role</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={String(user._id)}>
                                <TableCell>{user.email || user.username}</TableCell>
                                <TableCell className="text-right">
                                    <RoleSelect
                                        userId={String(user._id)}
                                        currentRole={(user.role ?? "reader") as RoleName}
                                        disabled={String(user._id) === session.user.id}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual verification**

Log in as `sunil@gmail.com` (Admin), visit `/dashboard/admin/users`, confirm every account is listed with its current role, that your own row's dropdown is disabled, and that changing another user's role succeeds and persists after a refresh.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/admin/users/page.tsx src/components/dashboard/admin/RoleSelect.tsx
git commit -m "Add admin-only user role management page"
```

---

## Task 18: Category management routes

**Files:**
- Create: `src/app/api/categories/route.ts`
- Create: `src/app/api/categories/[id]/route.ts`
- Test: `src/app/api/categories/route.test.ts`
- Test: `src/app/api/categories/[id]/route.test.ts`

**Interfaces:**
- Consumes: `withApiGuard` with `{ role: "admin" }` (Task 4); `slugify` from `@/libs/slug`.
- Produces: `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id`.

- [ ] **Step 1: Write the failing tests for creation**

```ts
// src/app/api/categories/route.test.ts
import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const createMock = vi.fn();
vi.mock("@/models/Category", () => ({
    default: { create: (...args: unknown[]) => createMock(...args) },
}));

const { POST } = await import("@/app/api/categories/route");

function requestWithBody(body: unknown) {
    return new NextRequest("http://localhost/api/categories", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/categories", () => {
    beforeEach(() => {
        createMock.mockReset();
    });

    it("rejects an empty title", async () => {
        const response = await POST(requestWithBody({ title: "  " }));
        expect(response.status).toBe(400);
        expect(createMock).not.toHaveBeenCalled();
    });

    it("creates a category, deriving the slug from the title", async () => {
        createMock.mockResolvedValue({ _id: "c1", title: "Deep Learning", slug: "deep-learning" });
        const response = await POST(requestWithBody({ title: "Deep Learning" }));

        expect(response.status).toBe(200);
        expect(createMock).toHaveBeenCalledWith({ title: "Deep Learning", slug: "deep-learning", visibility: true });
    });

    it("returns 409 on a duplicate slug", async () => {
        createMock.mockRejectedValue({ code: 11000 });
        const response = await POST(requestWithBody({ title: "Deep Learning" }));
        expect(response.status).toBe(409);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/categories/route.test.ts`
Expected: FAIL — route module doesn't exist.

- [ ] **Step 3: Implement creation**

```ts
// src/app/api/categories/route.ts
import { NextResponse } from "next/server";
import Category from "@/models/Category";
import { withApiGuard } from "@/libs/api-guard";
import { slugify } from "@/libs/slug";

export const POST = withApiGuard(
    async (request) => {
        try {
            const body = await request.json().catch(() => null);
            const title = (body?.title ?? "").trim();

            if (!title) {
                return NextResponse.json({ data: null, message: "Title is required" }, { status: 400 });
            }

            const category = await Category.create({ title, slug: slugify(title), visibility: true });
            return NextResponse.json({ data: { id: category._id.toString(), title: category.title, slug: category.slug }, message: "Success" });
        } catch (error) {
            if ((error as { code?: number }).code === 11000) {
                return NextResponse.json({ data: null, message: "A category with this name already exists" }, { status: 409 });
            }
            console.error("Failed to create category:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "admin" }
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/categories/route.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing tests for update/delete**

```ts
// src/app/api/categories/[id]/route.test.ts
import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/app/api/auth/[...nextauth]/auth", () => ({
    auth: vi.fn().mockResolvedValue({ user: { id: "admin1", role: "admin" } }),
}));

const findOneAndUpdateMock = vi.fn();
const softDeleteMock = vi.fn();
vi.mock("@/models/Category", () => ({
    default: {
        findOneAndUpdate: (...args: unknown[]) => findOneAndUpdateMock(...args),
        delete: (...args: unknown[]) => softDeleteMock(...args),
    },
}));

const existsMock = vi.fn();
vi.mock("@/models/Post", () => ({
    default: { exists: (...args: unknown[]) => existsMock(...args) },
}));

const { PATCH, DELETE } = await import("@/app/api/categories/[id]/route");

function context(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/categories/[id]", () => {
    beforeEach(() => {
        findOneAndUpdateMock.mockReset();
    });

    it("rejects an empty title", async () => {
        const request = new NextRequest("http://localhost/api/categories/c1", { method: "PATCH", body: JSON.stringify({ title: "" }) });
        const response = await PATCH(request, context("c1"));
        expect(response.status).toBe(400);
        expect(findOneAndUpdateMock).not.toHaveBeenCalled();
    });

    it("updates the title and re-derives the slug", async () => {
        findOneAndUpdateMock.mockResolvedValue({ _id: "c1", title: "AI & ML", slug: "ai-ml" });
        const request = new NextRequest("http://localhost/api/categories/c1", { method: "PATCH", body: JSON.stringify({ title: "AI & ML" }) });
        const response = await PATCH(request, context("c1"));

        expect(response.status).toBe(200);
        expect(findOneAndUpdateMock).toHaveBeenCalledWith({ _id: "c1" }, { title: "AI & ML", slug: "ai-ml" }, { new: true });
    });
});

describe("DELETE /api/categories/[id]", () => {
    beforeEach(() => {
        softDeleteMock.mockReset();
        existsMock.mockReset();
    });

    it("blocks deleting a category that still has posts", async () => {
        existsMock.mockResolvedValue({ _id: "p1" });
        const response = await DELETE(new NextRequest("http://localhost/api/categories/c1", { method: "DELETE" }), context("c1"));

        expect(response.status).toBe(400);
        expect(softDeleteMock).not.toHaveBeenCalled();
    });

    it("soft-deletes a category with no posts", async () => {
        existsMock.mockResolvedValue(null);
        softDeleteMock.mockResolvedValue({ matchedCount: 1 });
        const response = await DELETE(new NextRequest("http://localhost/api/categories/c1", { method: "DELETE" }), context("c1"));

        expect(response.status).toBe(200);
        expect(softDeleteMock).toHaveBeenCalledWith({ _id: "c1" }, "admin1");
    });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run "src/app/api/categories/[id]/route.test.ts"`
Expected: FAIL — route module doesn't exist.

- [ ] **Step 7: Implement update/delete**

```ts
// src/app/api/categories/[id]/route.ts
import { NextResponse } from "next/server";
import type { SoftDeleteModel } from "mongoose-delete";
import Category, { ICategory } from "@/models/Category";
import Post from "@/models/Post";
import { withApiGuard } from "@/libs/api-guard";
import { slugify } from "@/libs/slug";

const SoftDeleteCategory = Category as unknown as SoftDeleteModel<ICategory>;

interface RouteContext {
    params: Promise<{ id: string }>;
}

export const PATCH = withApiGuard<RouteContext>(
    async (request, { params }) => {
        try {
            const { id } = await params;
            const body = await request.json().catch(() => null);
            const title = (body?.title ?? "").trim();

            if (!title) {
                return NextResponse.json({ data: null, message: "Title is required" }, { status: 400 });
            }

            const category = await Category.findOneAndUpdate({ _id: id }, { title, slug: slugify(title) }, { new: true });
            if (!category) {
                return NextResponse.json({ data: null, message: "Category not found" }, { status: 404 });
            }

            return NextResponse.json({ data: { id: category._id.toString(), title: category.title, slug: category.slug }, message: "Success" });
        } catch (error) {
            if ((error as { code?: number }).code === 11000) {
                return NextResponse.json({ data: null, message: "A category with this name already exists" }, { status: 409 });
            }
            console.error("Failed to update category:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "admin" }
);

export const DELETE = withApiGuard<RouteContext>(
    async (request, { params, session }) => {
        try {
            const { id } = await params;

            const inUse = await Post.exists({ categoryId: id });
            if (inUse) {
                return NextResponse.json({ data: null, message: "Reassign or remove this category's posts first" }, { status: 400 });
            }

            const result = (await SoftDeleteCategory.delete({ _id: id }, session.user.id)) as unknown as { matchedCount: number };
            if (result.matchedCount === 0) {
                return NextResponse.json({ data: null, message: "Category not found" }, { status: 404 });
            }

            return NextResponse.json({ data: null, message: "Success" });
        } catch (error) {
            console.error("Failed to delete category:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { role: "admin" }
);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run "src/app/api/categories/[id]/route.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/app/api/categories/route.ts "src/app/api/categories/[id]/route.ts" src/app/api/categories/route.test.ts "src/app/api/categories/[id]/route.test.ts"
git commit -m "Add admin-only category management routes"
```

---

## Task 19: Category management page

**Files:**
- Create: `src/app/dashboard/admin/categories/page.tsx`
- Create: `src/components/dashboard/admin/CategoryFormDialog.tsx`
- Create: `src/components/dashboard/admin/DeleteCategoryButton.tsx`

**Interfaces:**
- Consumes: `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` (Task 18).

- [ ] **Step 1: Implement the create/edit dialog**

```tsx
// src/components/dashboard/admin/CategoryFormDialog.tsx
"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface CategoryFormDialogProps {
    category?: { id: string; title: string };
}

export default function CategoryFormDialog({ category }: CategoryFormDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(category?.title ?? "");
    const [pending, startTransition] = useTransition();
    const isEdit = Boolean(category);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        startTransition(async () => {
            try {
                const response = await fetch(isEdit ? `/api/categories/${category!.id}` : "/api/categories", {
                    method: isEdit ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title }),
                });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to save category.");
                    return;
                }
                toast.success(isEdit ? "Category updated." : "Category created.");
                setOpen(false);
                router.refresh();
            } catch {
                toast.error("Failed to save category.");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {isEdit ? (
                    <Button variant="ghost" size="icon-sm">
                        <Pencil />
                        <span className="sr-only">Edit category</span>
                    </Button>
                ) : (
                    <Button>
                        <Plus /> Add category
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
                        <DialogDescription>The slug is derived from the title automatically.</DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                        <Label htmlFor="category-title">Title</Label>
                        <Input id="category-title" value={title} onChange={(e) => setTitle(e.target.value)} required className="mt-1.5" />
                    </div>
                    <DialogFooter className="mt-6">
                        <Button type="submit" disabled={pending}>
                            {pending ? "Saving…" : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Implement the delete button**

```tsx
// src/components/dashboard/admin/DeleteCategoryButton.tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function DeleteCategoryButton({ id }: { id: string }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            try {
                const response = await fetch(`/api/categories/${id}`, { method: "DELETE" });
                const result = await response.json();
                if (!response.ok) {
                    toast.error(result.message || "Failed to delete category.");
                    return;
                }
                toast.success("Category deleted.");
                router.refresh();
            } catch {
                toast.error("Failed to delete category.");
            }
        });
    };

    return (
        <Button variant="ghost" size="icon-sm" onClick={handleDelete} disabled={pending}>
            <Trash2 />
            <span className="sr-only">Delete category</span>
        </Button>
    );
}
```

- [ ] **Step 3: Implement the page**

```tsx
// src/app/dashboard/admin/categories/page.tsx
import Category from "@/models/Category";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import CategoryFormDialog from "@/components/dashboard/admin/CategoryFormDialog";
import DeleteCategoryButton from "@/components/dashboard/admin/DeleteCategoryButton";

export default async function AdminCategoriesPage() {
    const categories = await Category.find({}).sort({ title: 1 }).lean();

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Categories</h1>
                    <p className="mt-2 text-muted-foreground">Every category posts can be filed under.</p>
                </div>
                <CategoryFormDialog />
            </div>

            <div className="mt-6 overflow-hidden rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Title</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categories.map((category) => (
                            <TableRow key={String(category._id)}>
                                <TableCell className="font-medium">{category.title}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{category.slug}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <CategoryFormDialog category={{ id: String(category._id), title: category.title }} />
                                        <DeleteCategoryButton id={String(category._id)} />
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual verification**

Log in as `sunil@gmail.com` (Admin), visit `/dashboard/admin/categories`: create a category, edit its title (confirm the slug updates), try deleting one that has posts (confirm it's blocked with a clear message), then delete an unused one successfully.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/admin/categories/page.tsx src/components/dashboard/admin/CategoryFormDialog.tsx src/components/dashboard/admin/DeleteCategoryButton.tsx
git commit -m "Add admin-only category management page"
```

---

## Task 20: Admin sub-navigation

**Files:**
- Create: `src/app/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `hasRole` (Task 1); wraps every page created in Tasks 8, 10, 15, 17, 19 plus the existing `/dashboard/posts`.

- [ ] **Step 1: Implement**

```tsx
// src/app/dashboard/layout.tsx
import Link from "next/link";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { hasRole } from "@/libs/roles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    // proxy.ts's matcher redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const role = session.user.role;

    const links = [
        { href: "/dashboard/posts", label: "My Posts", show: true },
        { href: "/dashboard/admin/posts", label: "Review Queue", show: hasRole(role, "moderator") },
        { href: "/dashboard/admin/comments", label: "Comments", show: hasRole(role, "moderator") },
        { href: "/dashboard/admin/requests", label: "Publish Requests", show: hasRole(role, "admin") },
        { href: "/dashboard/admin/users", label: "Users", show: hasRole(role, "admin") },
        { href: "/dashboard/admin/categories", label: "Categories", show: hasRole(role, "admin") },
    ].filter((link) => link.show);

    return (
        <div>
            <nav className="border-b border-border bg-card">
                <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 py-3">
                    {links.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground whitespace-nowrap hover:bg-accent hover:text-foreground"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </nav>
            {children}
        </div>
    );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual verification**

Log in as each of the five test accounts in turn (`alan@example.com` Reader, `ada@example.com`/`margaret@example.com` Author, `linus@example.com` Moderator, `grace@example.com`/`sunil@gmail.com` Admin) and confirm the sub-nav shows exactly the links that role has access to — nothing more.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "Add role-conditional admin sub-navigation to the dashboard"
```

---

## Task 21: Update the roadmap

**Files:**
- Modify: `docs/roadmap.md`

- [ ] **Step 1: Remove the now-built item**

In `docs/roadmap.md`, delete section "1. Admin/moderator role and cross-user review queue" in full (its current-behavior description is no longer accurate — the system it describes as missing now exists), and renumber the remaining sections (SEO/production plumbing becomes 1, real view tracking becomes 2, notifications becomes 3). Update the "Sequencing" section's numbered list and the reference to "item 1" the same way.

- [ ] **Step 2: Commit**

```bash
git add docs/roadmap.md
git commit -m "Remove the completed admin/moderator roadmap item"
```

---

## Task 22: Full end-to-end verification pass

**Files:** none (verification only).

- [ ] **Step 1: Automated checks**

Run: `npx tsc --noEmit && npm test`
Expected: both clean.

- [ ] **Step 2: Manual pass, one role at a time**

Start the dev server if not already running (`npm run dev -- --port=5000`). For each account, confirm the permission matrix in the spec holds in practice:

- `alan@example.com` (Reader): can comment/vote; `/posts/add` redirects away; sees "Request to publish" on `/dashboard/posts`; sub-nav shows only "My Posts".
- `ada@example.com` or `margaret@example.com` (Author): can create/edit/delete their own posts; cannot reach any `/dashboard/admin/*` page directly (redirects away).
- `linus@example.com` (Moderator): sees "Review Queue" and "Comments" in the sub-nav; can approve/reject any post and remove any comment; cannot reach `/dashboard/admin/users`, `/dashboard/admin/categories`, or `/dashboard/admin/requests` (redirects away).
- `grace@example.com` or `sunil@gmail.com` (Admin): sees every sub-nav link; can edit/delete any post, manage any user's role (except their own), approve/reject publish requests, and manage categories.

- [ ] **Step 3: Clean up**

Kill the dev server if this task started it (`ss -ltnp | grep :5000` to confirm the port is free afterward).

- [ ] **Step 4: Report**

Summarize what was verified and any discrepancies found against the spec, so they can be triaged before considering this feature complete.
