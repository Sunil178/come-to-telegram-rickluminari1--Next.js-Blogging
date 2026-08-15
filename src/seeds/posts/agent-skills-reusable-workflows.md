---
title: "Agent Skills: Teaching AI Assistants Reusable Workflows"
titleDescription: "Encode a workflow once, and let an agent load it automatically when it's relevant"
categorySlug: "technology"
tags: ["AI", "Agent Skills", "Automation"]
bannerImage: "https://images.unsplash.com/photo-1620200423727-8127f75d7f53"
summary: "Instead of re-explaining a process every time, a skill packages it once — instructions, and sometimes scripts or resources — for an agent to reach for on its own."
published: true
publishedAt: "2026-08-11"
approval: "Approved"
approvedAt: "2026-08-12"
visitorCount: 1540
---

A recurring workflow — how your team drafts a commit message, the checklist for a code review, the steps to safely run a database migration — used to mean either re-explaining it in every conversation with an AI assistant, or building an entirely separate custom agent just for that one task. Agent Skills, a pattern that's spread rapidly since being introduced by Anthropic in late 2025, take a different approach: package the workflow once, as a self-contained unit the agent can discover and load automatically whenever the current task actually calls for it — no separate agent required, and no re-explaining needed on the next conversation.

## What a skill actually is

Structurally, a skill is close to a small, well-organized folder: a short description of what it's for and when it applies, instructions for how to carry it out, and — for skills that need more than plain text — supporting scripts or reference files the agent can use as part of the workflow.

```
.claude/skills/
  commit-message/
    SKILL.md          # description + instructions
  db-migration-check/
    SKILL.md
    check-migration.sh # a script the skill can invoke
```

```md
---
name: commit-message
description: Draft a git commit message following this project's conventions
---

Draft a commit message for whatever is staged. Read the diff, not just the
file list. Match the repository's existing tone. Never stage or unstage
anything — only draft the message.
```

The key design point is the `description` field: it's what the agent reads, up front, to decide *whether this skill is relevant to what's being asked right now* — without having to load the skill's full instructions just to find out. This is what makes skills scale: an agent with access to dozens of skills doesn't need all of them in its working context at once, only the descriptions, until one is actually needed.

## Why this is a different shape than a custom agent

Building a dedicated agent for every recurring task doesn't scale well — each one needs its own configuration, its own maintenance, and switching between them is a deliberate action a person has to take. A skill is lighter-weight and composable: the same general-purpose agent picks up whichever skill fits the moment, mid-conversation, without anyone explicitly switching contexts. The workflow becomes a capability the agent has, not a separate tool a person has to remember exists and choose to invoke.

## Subagents: a related but distinct pattern

Where a skill packages *how* to do something, a subagent packages *who* does it — a subagent is a child agent, invoked by a main agent, that runs a specific task with its own isolated context window and often its own system prompt, then reports a result back:

```
Main agent
  ├─ delegates "research the current state of X" → Subagent (own context)
  ├─ delegates "review this diff for security issues" → Subagent (own context)
  └─ synthesizes both results into a final answer
```

The isolation is the point: a subagent doing a large, exploratory research task can fill its own context window with search results and intermediate reasoning without any of that noise polluting the main agent's context, which stays focused on the task at hand. Skills and subagents compose naturally — a subagent can itself load and use a skill relevant to its specific delegated task.

## Where this pattern has spread

What started as a single-vendor feature has been adopted more broadly since — several agent frameworks and platforms have added their own support for the same general shape (a discoverable, loadable unit of packaged workflow knowledge), which is a reasonable signal that the underlying idea is solving a real, common problem rather than being a one-off product feature. The common skill types that have emerged tend to cluster around a few shapes: research-and-synthesize workflows (aggregate results into a structured brief), data-transformation workflows (reshape a raw payload into something more useful downstream), and process-enforcement workflows (a checklist or convention that needs to be followed the same way every time, like a commit-message format or a deployment checklist).

## The underlying principle

Skills are, at their core, an application of a much older idea — don't repeat instructions, encode them once and reference them — applied to how an AI agent accumulates and reuses working knowledge of a team or project's specific conventions. The gain isn't that the agent becomes more capable in some abstract sense; it's that the same capability the agent already had gets applied *consistently*, every time the relevant situation comes up, instead of depending on someone remembering to restate the process correctly, from scratch, every single time.
