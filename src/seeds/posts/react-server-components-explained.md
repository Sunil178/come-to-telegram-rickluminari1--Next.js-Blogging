---
title: "Understanding React Server Components in Next.js"
titleDescription: "How RSCs change the way we think about data fetching and bundle size"
categorySlug: "technology"
tags: ["React", "Next.js", "Web Development"]
bannerImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6"
summary: "A practical guide to React Server Components — what they are, how they differ from client components, and when to reach for each."
published: true
publishedAt: "2026-03-04"
approval: "Approved"
approvedAt: "2026-03-05"
visitorCount: 2140
---

For most of React's history, every component you wrote ran twice: once conceptually on the server (to produce an initial HTML shell, if you bothered with server-side rendering at all) and once for real in the browser, where it re-executed, attached event listeners, and took over. React Server Components (RSCs) break that assumption. A Server Component runs **only** on the server. It never ships to the browser, never gets hydrated, and never re-runs on the client. What the browser receives is the result of that work — HTML and a compact description of the UI tree — not the code that produced it.

That distinction is the whole story, and it has real consequences for bundle size, data fetching, and how you structure an app.

## The mental model: two kinds of components

Next.js's App Router (`src/app/**`) treats every component as a Server Component by default. You opt into a Client Component explicitly, with a `"use client"` directive at the top of the file:

```tsx
// app/posts/[slug]/page.tsx — Server Component (default, no directive needed)
import Post from "@/models/Post";

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await Post.findOne({ slug }).lean(); // runs on the server, direct DB access
  return <article>{post?.title}</article>;
}
```

```tsx
// components/LikeButton.tsx
"use client";

import { useState } from "react";

export function LikeButton() {
  const [liked, setLiked] = useState(false); // useState only works on the client
  return <button onClick={() => setLiked(!liked)}>{liked ? "Liked" : "Like"}</button>;
}
```

The Server Component above talks to the database directly — no API route, no `fetch`, no client-side loading state. The Client Component below needs `"use client"` precisely because it uses `useState` and an `onClick` handler, both of which require the component to actually exist and run in the browser.

## Why this matters: bundle size and data-fetching waterfalls

Before RSCs, a component that needed data usually fetched it client-side, which meant: ship the component's JS to the browser, run it, discover it needs data, fire a request, wait, then render. Nest a few of these and you get a waterfall — each component blocking on its parent's fetch before it can start its own.

Server Components fetch data where the data lives, before anything is sent to the browser. There's no waterfall for the browser to sit through, and the code that queries your database — the ORM, the query logic, any secrets it touches — never ends up in the client JavaScript bundle at all. It simply isn't there to inspect.

| | Client-side fetching | Server Components |
|---|---|---|
| Where the fetch runs | Browser, after JS loads | Server, before HTML is sent |
| Database/API code in the bundle | Often yes (if not proxied) | Never |
| Loading state | Manual (`useState`, spinners) | Handled by `<Suspense>` boundaries |
| Re-runs on the client | Yes | No — output is static markup + a UI description |

## The boundary is one-directional

A Server Component can render a Client Component as a child. A Client Component **cannot** import a Server Component and render it directly — once you cross into client territory, everything below has to be client code too, because the browser needs to actually execute it. The workaround, when a client component needs server-rendered content inside it, is to pass that content down as `children`:

```tsx
// Server Component
import { LikeButton } from "@/components/LikeButton";
import { CommentList } from "@/components/CommentList"; // itself a Server Component

export default function Page() {
  return (
    <LikeButton>
      <CommentList /> {/* rendered on the server, passed in as children */}
    </LikeButton>
  );
}
```

`LikeButton` (client) never imports `CommentList` (server) — it just renders whatever `children` it's handed, and React resolves those on the server before the client ever sees them.

## Streaming with Suspense

Because a Server Component's output can be generated incrementally, Next.js can start streaming the parts of the page that are ready while slower parts are still loading:

```tsx
import { Suspense } from "react";

export default function Dashboard() {
  return (
    <>
      <Header /> {/* renders immediately */}
      <Suspense fallback={<StatsSkeleton />}>
        <SlowStats /> {/* streams in once its data resolves */}
      </Suspense>
    </>
  );
}
```

The browser gets the shell and the header right away, then the stats section fills in as soon as its own async work finishes — no blocking the whole page on the slowest query.

## When you actually need `"use client"`

Reach for a Client Component only when the code genuinely needs the browser: state (`useState`, `useReducer`), effects (`useEffect`), browser-only APIs (`localStorage`, `window`), or event handlers. Everything else — data fetching, formatting, anything that doesn't need to react to user interaction in place — belongs in a Server Component by default. Push `"use client"` as far down the tree as you can; marking a top-level layout as client-only drags everything beneath it into the client bundle whether it needed to be there or not.

The trade-off worth remembering: Server Components aren't "faster React," they're a different place to put your work. Used well, they shrink what actually has to ship to the browser to exactly the parts of the UI that need to be interactive — nothing more.
