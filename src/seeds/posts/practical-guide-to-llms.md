---
title: "A Practical Guide to Large Language Models"
titleDescription: "What's actually happening between typing a prompt and getting a response"
categorySlug: "technology"
tags: ["AI", "LLM", "Machine Learning"]
bannerImage: "https://images.unsplash.com/photo-1620121692029-d088224ddc74"
summary: "Tokens, context windows, and next-token prediction — the mechanics behind what feels like conversation."
published: true
publishedAt: "2026-05-13"
approval: "Approved"
approvedAt: "2026-05-14"
visitorCount: 2480
---

A large language model doesn't "know" facts the way a database does, and it doesn't "understand" a question the way a person does — what it actually does, at the mechanical level, is predict the most probable next token given everything that came before it, one token at a time, repeated until the response is complete. That single mechanism, trained at enormous scale on enormous amounts of text, is what produces something that reads as reasoning, coding, and conversation.

## Tokens, not words

Models don't process text as words or characters — they process **tokens**, which are often sub-word chunks. "Unbelievable" might tokenize as `Un` + `believ` + `able`; a common short word like "the" is usually a single token. This matters practically because pricing, rate limits, and context limits are all measured in tokens, not characters or words, and a rough rule of thumb (for English text) is that a token is about four characters on average.

```
Prompt: "Explain recursion in one sentence."
Tokens: ["Explain", " recursion", " in", " one", " sentence", "."]
       → 6 tokens (varies by tokenizer)
```

## The context window is a hard limit, not a suggestion

Every model has a maximum number of tokens it can consider at once — the **context window** — covering the system prompt, conversation history, any documents you've provided, and the response it's about to generate, all combined. Once a conversation exceeds that limit, the oldest content has to be dropped or summarized; the model isn't choosing to "forget," it mechanically cannot see tokens outside the window at all. This is also why pasting an entire codebase into a prompt and asking a narrow question is often worse than giving the model exactly the relevant files — more tokens in the window means more for the model to weigh when predicting what comes next, and irrelevant content is measurable noise, not free context.

## Next-token prediction, autoregressively

"Autoregressive" means the model generates output one token at a time, and each new token is chosen based on everything generated so far — including its own prior output in the same response:

```
Input: "The capital of France is"
Step 1: model predicts → " Paris" (highest probability next token)
Step 2: input becomes "The capital of France is Paris" → predicts "."
Step 3: response complete
```

This has a real consequence: a model can't "go back and reconsider" a token it already emitted mid-response the way a person editing a sentence can — each token becomes part of the fixed context for every token that follows it. It's also why techniques like asking a model to "think step by step" genuinely help: writing out intermediate reasoning as tokens gives the model that reasoning as context for the tokens that follow, rather than requiring the answer to emerge from a single forward pass with nothing to build on.

## Temperature: controlling how "confident" the sampling is

The model doesn't pick only the single highest-probability token every time — that would make output completely deterministic and often repetitive. A **temperature** parameter controls how much randomness is allowed in that choice:

| Temperature | Behavior |
|---|---|
| `0` | Nearly deterministic — almost always the highest-probability token |
| `~0.7` (a common default) | Balanced — some variety without wandering off-topic |
| `>1.2` | Noticeably more random, more prone to incoherent output |

Low temperature suits tasks with one clearly correct answer (code, extraction, classification); higher temperature suits creative or exploratory tasks where variety is actually the point.

## Why models sometimes state falsehoods confidently

A "hallucination" — a fluent, confident, wrong statement — isn't the model lying; it's the model doing exactly what it's built to do (predict plausible next tokens) in a case where "plausible" and "true" have come apart. Nothing in the base mechanism checks facts against reality; it generates text that's statistically consistent with its training data and the current context, and most of the time that correlates strongly with correctness, but that correlation isn't a guarantee, especially on obscure facts, recent events past the model's training cutoff, or precise numbers the model was never reliably trained on. This is the practical reason **Retrieval-Augmented Generation** exists (grounding responses in retrieved, verifiable source documents rather than the model's parametric memory alone) and why production systems that need factual reliability generally don't trust an LLM's unaided output for anything high-stakes without some form of verification or grounding.

> "The hottest new programming language is English." — Andrej Karpathy

The line is a little glib, but it points at something real: prompting is now a genuine interface between people and computation, and understanding the mechanics above — tokens, context windows, autoregressive generation, temperature — is what separates writing prompts by trial and error from understanding why a particular prompt actually works.
