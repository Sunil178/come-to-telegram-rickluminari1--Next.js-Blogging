---
title: "Model Context Protocol (MCP), Explained"
titleDescription: "A standard way for AI applications to connect to tools and data, instead of a one-off integration per pair"
categorySlug: "technology"
tags: ["AI", "MCP", "Tooling"]
bannerImage: "https://images.unsplash.com/photo-1518770660439-4636190af475"
summary: "MCP gives AI applications a consistent way to reach external tools and data sources — the same connector works across any host or server that speaks the protocol."
published: true
publishedAt: "2026-08-05"
approval: "Approved"
approvedAt: "2026-08-06"
visitorCount: 1980
---

Before the Model Context Protocol, connecting an AI application to an external system — a database, a ticketing tool, a file store — meant writing a bespoke integration for that specific pairing. A team supporting three AI hosts and ten external tools was looking at up to thirty separate integrations, each with its own auth handling, its own way of describing what it could do, its own quirks. MCP, introduced by Anthropic as an open standard, replaces that with one protocol: build an MCP server once for a tool, and any MCP-compatible AI application can use it, unmodified.

## The client-server architecture

MCP has three roles, and the naming is worth being precise about, because "server" here doesn't mean what it usually means in web development:

- **Host** — the AI application itself (an IDE assistant, a chat client, an agent framework).
- **Client** — lives inside the host, and manages the connection to one specific MCP server.
- **Server** — a separate process that exposes tools, resources, and prompts to any client that connects to it.

```
┌──────────────────────────────┐
│  Host (e.g. an AI assistant) │
│   ┌───────┐    ┌───────┐     │
│   │Client │    │Client │     │
│   └───┬───┘    └───┬───┘     │
└───────┼────────────┼─────────┘
        │            │
        ▼            ▼
  MCP Server A   MCP Server B
  (database)     (issue tracker)
```

A single host can hold several client connections simultaneously — one per MCP server it's been configured to use — and each server is independent, unaware of the others.

## Tools vs. resources: two different things a server exposes

**Tools** are functions the model can invoke to *do* something: query a database, create a ticket, send a request to an API. **Resources** are data the model can *read*: file contents, records, configuration — context, not actions.

```json
// A tool definition an MCP server might expose
{
  "name": "search_posts",
  "description": "Search blog posts by keyword",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" }
    },
    "required": ["query"]
  }
}
```

The model doesn't need custom code to understand this tool — the schema itself describes what arguments it takes, and the host's own general tool-calling machinery handles invoking it. This is the actual leverage MCP provides: a new MCP server, once written, works with any MCP-aware host, because the interface between them is standardized, not bespoke per integration.

## Why this matters more than it might first appear

The alternative to a shared protocol isn't "no integrations," it's "N × M integrations" — every AI application wiring up its own connector to every tool it wants to support, duplicated across the whole ecosystem. A standard protocol turns that into "N + M": each tool builds one MCP server, each host builds one MCP client implementation, and any combination of the two just works. This is precisely the value proposition Anthropic's own framing leans on — the protocol described as something like a USB-C port for AI applications: one physical/logical interface, usable across many different devices, instead of a different cable for every combination.

## A minimal server, conceptually

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({ name: "blog-search", version: "1.0.0" });

server.tool(
  "search_posts",
  { query: { type: "string" } },
  async ({ query }) => {
    const results = await Post.find({ $text: { $search: query } }).limit(5).lean();
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  }
);
```

Any MCP-compatible host that connects to this server can now call `search_posts` — the host doesn't need to know anything about MongoDB, this app's schema, or how the search is implemented. It only needs to understand the MCP protocol itself, which it already does.

## What changed in the 2026 protocol revision

MCP has continued to evolve since its introduction — the most recent specification update (dated 2026-07-28) moved toward a stateless protocol core, added support for multi-round-trip requests within a single tool call, introduced header-based routing, made list results cacheable, and hardened the authorization model. The direction is consistent: making the protocol robust enough for genuinely production-grade, multi-server, security-conscious deployments, not just single-developer local setups — reflecting how quickly MCP has moved from "a promising standard" to something with real production traffic across both major SDKs.

## The practical takeaway

If you're building a tool you want an AI agent to use, building it as an MCP server means writing that integration once, rather than betting on one specific AI vendor's proprietary plugin format and rewriting it if you switch. The protocol is doing for AI tool integration roughly what REST and OpenAPI did for regular web APIs: not eliminating the need for good design, but giving every implementation a shared, well-understood shape to converge on.
