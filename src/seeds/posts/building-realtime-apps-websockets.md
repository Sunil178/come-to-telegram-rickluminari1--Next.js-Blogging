---
title: "Building Real-Time Apps with WebSockets"
titleDescription: "When HTTP request/response isn't the right shape for the problem"
categorySlug: "technology"
tags: ["WebSockets", "Real-Time", "Web Development"]
bannerImage: "https://images.unsplash.com/photo-1607706189992-eae578626c86"
summary: "WebSockets give you a persistent, two-way connection — the right tool once your app needs the server to speak first."
published: true
publishedAt: "2026-07-01"
approval: "Approved"
approvedAt: "2026-07-02"
visitorCount: 1550
---

HTTP was built around a request/response model: the client asks, the server answers, the connection's job is done. That's a fine fit for most of the web, and a poor fit for anything where the server needs to tell the client something *without* being asked first — a chat message arriving, a live score updating, another user's cursor moving in a collaborative document. WebSockets exist for exactly that gap: a single, persistent, full-duplex connection where either side can send a message to the other at any time, with none of the overhead of opening a new HTTP request per message.

## The handshake: it starts as HTTP

A WebSocket connection begins as a normal HTTP request, with a special `Upgrade` header asking to switch protocols:

```
GET /ws HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

If the server agrees, it responds with `101 Switching Protocols`, and from that point on, the same underlying TCP connection stops speaking HTTP and starts speaking the WebSocket protocol — a lightweight framing format for sending discrete messages in either direction, with no new connection setup per message the way a fresh HTTP request would require.

## A minimal client and server

```ts
// Client
const socket = new WebSocket("wss://example.com/ws");

socket.onopen = () => socket.send(JSON.stringify({ type: "join", room: "post-42" }));

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "new-comment") renderComment(data.comment);
};

socket.onclose = () => console.log("Disconnected");
```

```ts
// Server (Node.js, `ws` library)
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (socket) => {
  socket.on("message", (raw) => {
    const data = JSON.parse(raw.toString());
    if (data.type === "join") {
      socket.room = data.room;
    }
  });

  // broadcasting a new comment to everyone in the same room
  function broadcastComment(room: string, comment: unknown) {
    wss.clients.forEach((client) => {
      if (client.room === room && client.readyState === client.OPEN) {
        client.send(JSON.stringify({ type: "new-comment", comment }));
      }
    });
  }
});
```

Note that the server can call `client.send(...)` at any time — not just in response to a message it just received. That's the actual capability polling can only ever approximate.

## Why not just poll?

Polling — the client asking "anything new?" every few seconds — can simulate real-time updates, but at a real cost: most polls return "no, nothing changed," which is wasted requests, wasted server load, and by definition a delay of up to the polling interval before an update is even visible. A WebSocket connection sits open and idle until there's actually something to send, at which point it's delivered immediately, with none of that per-request overhead repeated for every check.

| | Polling | WebSockets |
|---|---|---|
| Latency | Bounded by poll interval | Near-immediate |
| Server load (idle) | Constant, regardless of activity | Minimal — an open, idle connection |
| Server → client push | Not possible; client must ask | Native |
| Complexity | Simple — just repeated HTTP requests | Needs connection lifecycle management |

## What a WebSocket connection doesn't give you for free

A dropped WiFi connection, a laptop going to sleep, a server restart during a deploy — all of these silently kill a WebSocket connection, and neither side gets a clean, guaranteed notification the instant it happens. Production WebSocket clients need reconnection logic with backoff, and servers need a way to detect dead connections (a periodic ping/pong heartbeat is the standard approach — if a pong doesn't come back within a timeout, the server assumes the client is gone and cleans up).

Scaling also isn't automatic: a WebSocket connection is **stateful** and pinned to one specific server process, unlike a stateless HTTP request that any server behind a load balancer can handle. Broadcasting a message to all clients in a "room" only works directly if every one of those clients happens to be connected to the same server instance — at real scale, this needs a shared layer (Redis pub/sub is the common choice) so a message published on one server instance reaches clients connected to a different instance.

## When WebSockets are the right call, and when they aren't

Chat, live collaborative editing, multiplayer state, live dashboards with frequent updates, and live voting/comment counts (this app's own comment section is a reasonable candidate) are all genuine WebSocket use cases — the server has something to say to the client without being asked. A page that just needs to reflect data that changes once every few minutes is usually better served by simple polling or `revalidate`-based caching — the operational complexity of managing persistent connections at scale is a real cost, and it's only worth paying when the latency and server-push requirement are genuinely there.
