---
title: "Serverless Computing Explained"
titleDescription: "There are still servers — you just stop being the one who manages them"
categorySlug: "technology"
tags: ["Serverless", "Cloud", "Infrastructure"]
bannerImage: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31"
summary: "Serverless trades control over the runtime environment for not having to think about it at all — a real trade, not a free lunch."
published: true
publishedAt: "2026-07-08"
approval: "Approved"
approvedAt: "2026-07-09"
visitorCount: 1290
---

"Serverless" is a slightly misleading name — there are, obviously, still servers involved. What's actually gone is your responsibility for them: no provisioning, no OS patching, no capacity planning, no server that sits idle (and billed) at 3am waiting for traffic that isn't coming. You write a function, deploy it, and the cloud provider handles running it, scaling it up when traffic arrives, and scaling it back down to zero when it doesn't.

## The execution model: functions, not servers

A traditional server process runs continuously, handling requests as they arrive, whether there's one request a minute or a thousand a second. A serverless function only exists — as an active, running instance — while it's handling an invocation:

```ts
// A serverless function (AWS Lambda style) — this handler is the entire deployable unit
export async function handler(event: { body: string }) {
  const { slug } = JSON.parse(event.body);
  const post = await Post.findOne({ slug }).lean();
  return {
    statusCode: 200,
    body: JSON.stringify(post),
  };
}
```

There's no `app.listen()`, no persistent process. The platform invokes `handler` when a request arrives, and the function's job is to handle that one invocation and return — it doesn't manage its own lifecycle the way a traditional server does.

## Cold starts: the trade-off that actually matters

Because a function isn't a continuously running process, an invocation after a period of inactivity has to first *start* an execution environment — allocate resources, load the runtime, initialize the function's code — before it can even begin handling the request. This is a **cold start**, and it's real, measurable latency (anywhere from tens of milliseconds to a few seconds, depending on the runtime and how much initialization the function does) that a traditional always-running server doesn't pay, because it's already warm and waiting.

```
Cold start:  [allocate env] → [init runtime] → [run handler] → response (slow)
Warm start:                                     [run handler] → response (fast)
```

Providers keep recently-used execution environments around for a while specifically to avoid re-paying this cost on every request — a function invoked frequently stays "warm" and skips straight to running the handler. This is also why lighter runtimes (edge functions, in particular) that don't need a full language runtime boot are meaningfully faster to cold-start than a function that has to initialize, say, a full JVM.

## Pricing: pay for execution, not for idle capacity

A traditional server costs the same whether it's handling peak traffic or sitting nearly idle overnight — you're paying for the capacity to exist, not for the work it's actually doing. Serverless billing is typically per-invocation plus execution duration: an endpoint hit once an hour costs close to nothing, and an endpoint hit a million times costs proportionally to that actual usage. This is the economic case for serverless on spiky or unpredictable workloads — you stop paying for headroom you don't need most of the time — and it's a much weaker case for a service under constant, high, predictable load, where a reserved traditional server (or a reserved-capacity cloud instance) is often cheaper per request at that scale.

## Statelessness is a hard requirement, not a suggestion

A serverless function can't reliably hold state in memory between invocations — the execution environment handling your next request might be a completely different instance than the one that handled the last, or the same one after being torn down and recreated. Any state that needs to persist has to live somewhere external: a database, a cache like Redis, object storage. This isn't a limitation to work around cleverly — designing for it from the start (every invocation is self-contained, reads what it needs, writes what it needs, keeps nothing in memory across requests) is simply what correct serverless code looks like.

```ts
// ❌ assumes in-memory state survives between invocations — it might not
let requestCount = 0;
export async function handler() {
  requestCount++; // unreliable — a different instance might handle the next call
  return { statusCode: 200, body: `${requestCount}` };
}

// ✅ state lives externally, where every invocation can see it consistently
export async function handler() {
  const count = await redis.incr("request-count");
  return { statusCode: 200, body: `${count}` };
}
```

## Where serverless is a genuinely good fit

| Good fit | Weaker fit |
|---|---|
| Spiky, unpredictable, or infrequent traffic | Constant, high, predictable load |
| Event-driven work (image resize on upload, a webhook handler) | Long-running processes (minutes+, most platforms cap execution time) |
| Teams that want zero infrastructure management | Workloads needing persistent in-memory state (a cache warmed once, kept hot) |
| APIs with long idle periods between bursts | Latency-critical paths where cold starts are unacceptable |

The honest framing: serverless doesn't eliminate operational complexity, it relocates it — from "manage the server" to "design every function to be stateless, idempotent, and tolerant of cold starts." That's a real simplification for a lot of workloads, and a real constraint for the ones that don't fit that shape.
