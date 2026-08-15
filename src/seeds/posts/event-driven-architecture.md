---
title: "Event-Driven Architecture with Message Queues"
titleDescription: "Decoupling services by having them talk through events instead of direct calls"
categorySlug: "technology"
tags: ["Architecture", "Message Queues", "Backend"]
bannerImage: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485"
summary: "When Service A calls Service B directly, they're coupled to each other's uptime. Events let them communicate without either one waiting on the other."
published: true
publishedAt: "2026-06-17"
approval: "Approved"
approvedAt: "2026-06-18"
visitorCount: 1410
---

When one service calls another directly over HTTP, it's implicitly betting that the other service is up, fast enough, and ready right now — if the notifications service is down, and the orders service calls it synchronously when an order is placed, order placement itself breaks, even though notifications are arguably not essential to completing an order at all. Event-driven architecture removes that direct dependency: instead of calling a service, a service publishes an **event** — "this happened" — to a message broker, and any number of other services can react to it independently, on their own schedule.

## Synchronous calls vs. events

```
Synchronous (direct call):
  OrderService --HTTP call--> NotificationService
  (if NotificationService is down, this call fails or times out)

Event-driven:
  OrderService --publish "OrderPlaced"--> Message Broker
                                                ↓
                          NotificationService (subscribed, reacts when it's ready)
                          InventoryService (subscribed, reacts independently)
                          AnalyticsService (subscribed, reacts independently)
```

`OrderService` doesn't know or care who's listening for `OrderPlaced` events, or how many services are. It publishes the event and moves on. If `NotificationService` is temporarily down, the event waits in the queue until it comes back — order placement itself was never blocked on it.

## A concrete example

```ts
// Publisher — OrderService, after successfully creating an order
await messageBroker.publish("order.placed", {
  orderId: order._id,
  userId: order.userId,
  total: order.total,
  timestamp: new Date().toISOString(),
});
```

```ts
// Subscriber — NotificationService, running independently
messageBroker.subscribe("order.placed", async (event) => {
  await sendEmail(event.userId, `Your order ${event.orderId} was placed!`);
});
```

```ts
// A second, unrelated subscriber — InventoryService
messageBroker.subscribe("order.placed", async (event) => {
  await decrementStock(event.orderId);
});
```

Neither subscriber knows the other exists. `OrderService` doesn't know either of them exists. Adding a third subscriber later — say, an `AnalyticsService` — requires zero changes to `OrderService` at all; it's already broadcasting the event, and anything can start listening.

## Queues vs. pub/sub — a real distinction

These get used loosely as synonyms, but the delivery guarantee differs:

| | Queue (e.g. SQS, RabbitMQ queue) | Pub/Sub (e.g. Kafka, SNS) |
|---|---|---|
| Delivery | One consumer processes each message | Every subscriber gets a copy of every message |
| Use case | Distributing work across workers (only one should handle each job) | Broadcasting an event to multiple independent interested parties |
| Example | A queue of image-resize jobs, any one worker picks each up | An `OrderPlaced` event that notifications, inventory, and analytics all separately react to |

Picking the wrong one produces a real bug: a queue used for broadcast means only one subscriber ever sees each event (the others silently miss it); pub/sub used for distributing work means every worker processes every job redundantly.

## At-least-once delivery means idempotency isn't optional

Most message brokers guarantee **at-least-once** delivery, not exactly-once — a message can be delivered twice, usually because a consumer processed it but crashed before acknowledging that fact, so the broker redelivers it to be safe. A subscriber that isn't written to handle duplicate delivery will, eventually, double-charge a card or send a duplicate email:

```ts
// ❌ not idempotent — processing the same event twice sends two emails
messageBroker.subscribe("order.placed", async (event) => {
  await sendEmail(event.userId, `Order ${event.orderId} placed!`);
});

// ✅ idempotent — a duplicate delivery is a safe no-op
messageBroker.subscribe("order.placed", async (event) => {
  const alreadySent = await NotificationLog.findOne({ eventId: event.id });
  if (alreadySent) return;
  await sendEmail(event.userId, `Order ${event.orderId} placed!`);
  await NotificationLog.create({ eventId: event.id });
});
```

Designing every event handler to be safely re-runnable — checking whether the effect already happened before applying it again — is the actual discipline event-driven systems require, not an edge case to handle later.

## Eventual consistency is the trade-off, not a bug

In a synchronous system, when the order-placement request returns, everything related to it has already happened. In an event-driven system, `OrderService` finishes and returns immediately, while `NotificationService` and `InventoryService` react moments later, asynchronously — there's a brief window where the order exists but inventory hasn't been decremented yet. This is **eventual consistency**: the system converges to a correct state, just not all at the same instant. It's the right trade-off when immediate consistency isn't actually required (a notification arriving half a second later is fine) and the wrong one when it is (you generally don't want "eventually" consistent payment processing) — knowing which category a given piece of logic falls into is the actual design decision, before reaching for events at all.
