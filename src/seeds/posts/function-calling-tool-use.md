---
title: "Function Calling & Tool Use: How LLMs Take Action"
titleDescription: "The mechanism that lets a model do more than generate text"
categorySlug: "technology"
tags: ["AI", "Function Calling", "LLM"]
bannerImage: "https://images.unsplash.com/photo-1666875753105-c63a6f3bdc86"
summary: "A model doesn't execute code itself — it describes what it wants called, and your application decides whether and how to actually do it."
published: true
publishedAt: "2026-08-15"
approval: "Approved"
approvedAt: "2026-08-15"
visitorCount: 890
---

On its own, a language model only generates text — it has no ability to query a database, hit an API, or read a file. Function calling (also called tool use) closes that gap, not by giving the model direct execution access, but through a structured protocol: you describe the functions available, in a schema the model can read, and the model responds by describing *which* function it wants called and with *what* arguments — as structured data, not free text. Your application is the one that actually executes it, checks the result, and decides what to do with it.

## The request/response cycle

```
1. You send the model a prompt + a list of available tool schemas
2. The model responds with either plain text, OR a structured tool-call
   request: { name: "get_weather", arguments: { city: "Tokyo" } }
3. Your application executes that function for real
4. You send the function's result back to the model as a new message
5. The model incorporates that result into its next response
```

The model never runs code — steps 3 and 5 make the boundary explicit: the model *requests* an action and *receives* a result, but the actual execution, and any safety checks around it, live entirely in application code you control.

## A worked example

```ts
const tools = [
  {
    name: "get_post_by_slug",
    description: "Fetch a blog post's title, summary, and vote counts by its slug",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
  },
];

const response = await client.messages.create({
  model: "claude-sonnet-5",
  messages: [{ role: "user", content: "How many upvotes does the RAG post have?" }],
  tools,
});

// The model responds with a tool_use block instead of (or alongside) plain text:
// { type: "tool_use", name: "get_post_by_slug", input: { slug: "retrieval-augmented-generation-explained" } }

if (response.content[0].type === "tool_use") {
  const { slug } = response.content[0].input;
  const post = await Post.findOne({ slug }).select("upvoteCount").lean();

  // Send the result back so the model can use it in its actual answer
  const followUp = await client.messages.create({
    model: "claude-sonnet-5",
    messages: [
      { role: "user", content: "How many upvotes does the RAG post have?" },
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: response.content[0].id, content: JSON.stringify(post) }],
      },
    ],
    tools,
  });
}
```

The model decided, on its own, that answering the question required calling `get_post_by_slug` rather than guessing — that decision is the actual capability function calling provides: the model reasons about *when* a tool is needed, not just how to format one call correctly.

## Why the schema matters as much as the prompt

A tool's `description` field isn't documentation for a human reading the code — it's the primary signal the model uses to decide whether and how to call that tool. A vague description ("gets data") gives the model little to work with when deciding whether this tool is relevant to a given question; a precise one ("fetch a blog post's title, summary, and vote counts by its exact slug") lets the model correctly judge both *when* to reach for it and *what* arguments it needs — the schema is effectively a contract, and an ambiguous contract produces ambiguous tool-selection behavior, the same way an ambiguous API produces confused clients.

## This is what MCP standardizes

Function calling as described above is usually vendor-specific in its exact request/response format — different model providers structure tool-call messages slightly differently. The Model Context Protocol builds on the same underlying idea (describe available functions via a schema, let the model request calls, execute them externally) but standardizes the transport and discovery layer, so a tool exposed once as an MCP server can be called through this same fundamental mechanism by any MCP-compatible host, rather than needing a bespoke integration per model provider.

## Where the actual safety boundary lives

It's worth being precise about what function calling does and doesn't guarantee: the model can *request* a tool call, but nothing forces your application to honor every request blindly. A well-built system treats every tool-call request the same way it would treat input from an untrusted client — validating arguments, enforcing permissions, and, for anything destructive (deleting data, sending a real email, spending money), often requiring explicit confirmation before actually executing it. The model proposing an action and your application deciding whether to actually take it are two separate, deliberately separated steps — collapsing them, and executing whatever the model requests without any check, is where most of the real-world risk in tool-using AI systems actually comes from.
