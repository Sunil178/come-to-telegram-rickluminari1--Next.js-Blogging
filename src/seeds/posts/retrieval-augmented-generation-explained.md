---
title: "Retrieval-Augmented Generation (RAG), Explained"
titleDescription: "How to make an LLM answer from your documents instead of its training data"
categorySlug: "technology"
tags: ["AI", "RAG", "LLM"]
bannerImage: "https://images.unsplash.com/photo-1591696205602-2f950c417cb9"
summary: "RAG grounds a model's answers in retrieved, specific documents at query time — the most practical fix for both stale knowledge and hallucination."
published: true
publishedAt: "2026-05-20"
approval: "Approved"
approvedAt: "2026-05-21"
visitorCount: 1910
---

An LLM's knowledge is frozen at whatever point its training data was collected, and even within that window, it has no reliable way to cite where a specific fact came from or to answer questions about documents it never saw — your company's internal wiki, a codebase, a product manual written last week. Retrieval-Augmented Generation, introduced by Patrick Lewis and colleagues at Facebook AI Research in a 2020 paper, solves both problems the same way: instead of relying solely on what the model memorized during training, retrieve the specific, relevant documents at query time and hand them to the model as part of the prompt, so it answers from what's actually in front of it.

## The pipeline, step by step

```
User question
      ↓
1. Embed the question into a vector
      ↓
2. Search a vector database for the most similar document chunks
      ↓
3. Insert those chunks into the prompt as context
      ↓
4. LLM generates an answer, grounded in the retrieved text
```

Each stage does distinct work, and each is a place things commonly go wrong:

```ts
async function answerQuestion(question: string): Promise<string> {
  // 1. Turn the question into a vector using an embedding model
  const questionEmbedding = await embed(question);

  // 2. Find the most similar chunks in a vector database
  const relevantChunks = await vectorDb.search(questionEmbedding, { topK: 5 });

  // 3. Build a prompt that includes the retrieved context
  const context = relevantChunks.map((c) => c.text).join("\n\n");
  const prompt = `Answer the question using only the context below.
If the answer isn't in the context, say you don't know.

Context:
${context}

Question: ${question}`;

  // 4. Generate the answer, grounded in that context
  return llm.generate(prompt);
}
```

The explicit "if the answer isn't in the context, say you don't know" instruction matters more than it looks — without it, a model will often fall back on its own parametric memory (or fabricate something plausible-sounding) rather than admitting the retrieved documents didn't actually cover the question.

## Chunking: the unglamorous step that determines quality

Documents get split into smaller pieces before embedding, because embedding an entire long document as one vector loses the specificity needed to match a narrow question, and because context windows have limits. How you split matters more than most RAG tutorials let on:

| Chunking strategy | Trade-off |
|---|---|
| Fixed-size (e.g. 500 tokens) | Simple, but can cut a sentence or table in half mid-chunk |
| Sentence/paragraph-aware | Respects natural boundaries, sizes vary more |
| Overlapping windows | Reduces the "cut in half" problem, at the cost of some duplicated content across chunks |
| Semantic chunking (split at topic boundaries) | Best retrieval relevance, most expensive to compute |

A chunk that splits a table's header from its rows, or a function signature from its body, will retrieve as a fragment that's technically relevant and practically useless — this is a more common failure mode in production RAG systems than a bad embedding model.

## Why embeddings, not keyword search

A vector embedding places text in a high-dimensional space where semantic similarity corresponds to geometric closeness — "How do I reset my password?" and "I forgot my login credentials" land near each other even though they share almost no words. Traditional keyword search would miss that match entirely. In practice, many production RAG systems use **hybrid search** — combining vector similarity with traditional keyword/BM25 search — because pure semantic search occasionally misses exact-match cases (a specific error code, a product SKU) that keyword search catches trivially.

## What RAG fixes, and what it doesn't

RAG directly addresses two real problems: **staleness** (the model's training data has a cutoff, but your retrieved documents can be updated today) and **hallucination on facts outside training data** (grounding the answer in retrieved text gives the model something concrete to work from, and lets you show the user exactly which source it came from). What RAG does *not* fix is a model reasoning incorrectly about correctly retrieved context, or a retrieval step that confidently returns the wrong documents — a RAG system is only as reliable as its retrieval step, and a well-grounded wrong answer is still wrong, just wrong with citations.

## A minimal but important detail: citing sources

A RAG response that doesn't show which retrieved chunk it drew from is much harder for a user to verify — and verifiability is most of the point:

```ts
return {
  answer: llmResponse,
  sources: relevantChunks.map((c) => ({ title: c.documentTitle, url: c.sourceUrl })),
};
```

Surfacing sources turns "trust the AI" into "here's exactly where this came from, go check it" — which is a meaningfully different, and more defensible, product to build.
