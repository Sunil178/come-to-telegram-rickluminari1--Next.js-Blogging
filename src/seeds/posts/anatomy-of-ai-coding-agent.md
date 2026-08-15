---
title: "Anatomy of a Modern AI Coding Agent"
titleDescription: "Terminal-native, IDE-native, and extension-based — three different shapes for the same underlying idea"
categorySlug: "technology"
tags: ["AI", "Developer Tools", "Coding Agents"]
bannerImage: "https://images.unsplash.com/photo-1677442136019-21780ecad995"
summary: "AI coding tools converged on agentic behavior — reading a codebase, planning, editing multiple files — but they still differ meaningfully in where and how they run."
published: true
publishedAt: "2026-08-08"
approval: "Approved"
approvedAt: "2026-08-09"
visitorCount: 2620
---

The first generation of AI coding assistants completed one line at a time, reacting to whatever you'd just typed. The current generation of tools does something different: given a task described in a sentence or two, they read the relevant parts of a codebase, form a plan, make changes across multiple files, run commands to verify the result, and iterate — closer to a junior engineer working through a ticket than an autocomplete engine. That shift is what "agentic" means in this context, and it's now common across tools that otherwise look quite different from each other.

## The common agent loop

Underneath the differences in interface, most modern coding agents run a broadly similar loop:

```
1. Understand the task (read the prompt, relevant files, project conventions)
2. Plan (break the task into steps, possibly explicitly, possibly implicitly)
3. Act (edit files, run shell commands, call tools)
4. Observe (read command output, test results, errors)
5. Repeat steps 3–4 until the task is done or it needs clarification
```

The "observe and repeat" part is what separates an agent from a one-shot code generator — a tool that edits a file, runs the type checker, sees an error, and fixes it *without being asked again* is exercising a fundamentally different capability than one that generates a diff and stops, regardless of whether that diff actually compiles.

## Three shapes of the same idea

**Terminal-native agents** (Claude Code is the clearest example) run as a CLI tool, operating directly on your working directory through the same shell, file system, and version control you'd use by hand. This gives them a very direct, unopinionated relationship with the actual project — no separate editor to sync state with — and tends to favor an explicit plan-then-implement workflow for larger changes, which is part of why this style of agent is often reported as producing more architecturally coherent results on changes spanning many files: the plan is formed before the edits start, not discovered reactively file by file.

**IDE-native agents** (Cursor is the clearest example) are built as a full editor, with the agent as a first-class part of that editor's own UI — inline diffs, a chat panel beside the code, visual review of proposed changes before they're accepted. The tight coupling to a dedicated editor is the trade-off: a more integrated, visual day-to-day experience, in exchange for the tool being the editor you use, not a layer added on top of whichever editor you already had.

**Extension-based agents** (GitHub Copilot's agent mode is the clearest example) attach to an existing editor (VS Code, JetBrains, and others) as a plugin, rather than requiring a dedicated environment. This trades some depth of integration for reach — it meets developers in whatever editor they already use — and tends to lean on deep integration with the surrounding platform (pull requests, issues, CI) rather than the editor session alone.

## What they actually share, despite the different shells

| Capability | Common across all three |
|---|---|
| Multi-file editing | Yes — none of them are limited to one file at a time anymore |
| Reading the existing codebase for context | Yes — conventions, existing patterns, related files |
| Running commands (tests, builds, linters) | Yes, in some form, to verify their own work |
| Tool/function calling (often via MCP or an equivalent) | Increasingly standard, for reaching external systems |
| A planning step before large changes | Present in all three, though how explicit/visible it is to the user varies |

## The genuinely open design question: how much autonomy, and where

The meaningful differences between these tools today are less about raw capability and more about *workflow philosophy* — how much a developer reviews before changes are applied, how proactively the agent asks clarifying questions versus just proceeding, and how much of the surrounding platform (PRs, CI, issue trackers) it's wired into versus treating as out of scope. A terminal-native agent tends to assume longer, more autonomous stretches of work on a clearly-scoped task; an IDE-native agent tends to assume tighter, more visual, more frequently-reviewed iteration; an extension-based agent tends to assume it's one part of a broader existing platform workflow, not the whole workflow.

## The practical pattern that's emerged

Rather than one tool winning outright, a hybrid pattern is common in practice: a fast, tightly-integrated IDE or extension-based agent for day-to-day inline editing, and a terminal-native agent reached for deliberately on larger, multi-file, well-specified tasks where an explicit plan-first approach pays off. That's not a compromise so much as a recognition that "AI coding agent" isn't one job — quick inline suggestions and large autonomous refactors are different tasks with different ideal shapes of tool, even when the underlying models doing the reasoning are converging in capability.
