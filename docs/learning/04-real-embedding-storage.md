# 04 - Real Embedding Storage

## Previous Steps

We started with a visible RAG preview: synthetic documents are loaded, split into stable chunks, and shown in the UI for human review. Then we locked the embedding model and vector size: `text-embedding-3-small` with 1536 dimensions.

## What Changed In This Step

This step moves the system from preview-only to real storage:

1. The app still loads and chunks the synthetic markdown files.
2. A dashboard action sends the reviewed document and chunk payloads to Convex.
3. Convex stores source documents and chunks idempotently.
4. Convex calls Microsoft Foundry for real embeddings.
5. Convex validates every embedding has 1536 dimensions.
6. Convex stores the embedding vector and metadata on each chunk.
7. The dashboard shows preview count, stored count, embedded count, and the last run status.

## Why Convex Generates The Embeddings

Embedding calls need the Foundry API key. That key must stay server-side, so the browser never calls Foundry directly.

The flow is:

```text
Browser form
  -> Next.js server action
  -> Convex action
  -> Microsoft Foundry embedding endpoint
  -> Convex internal mutation
  -> stored chunk vectors
```

Convex actions can call external APIs. Convex mutations write to the database. Keeping those roles separate makes the system easier to reason about and safer to retry.

## Why Idempotent Imports Matter

RAG indexes are rebuilt often while you improve chunking rules, source documents, or embedding models. Idempotent upserts mean the same chunk id updates the existing row instead of creating duplicates.

For this project:

- `sourceDocuments.source` identifies one markdown file.
- `documentChunks.chunkId` identifies one generated chunk.
- Re-running the embedding step refreshes those same records.

## What This Still Does Not Do

This step stores embeddings, but it does not search them yet.

The next step is retrieval:

1. Embed a user question with the same model.
2. Search Convex for nearby chunk vectors.
3. Show retrieved chunks and similarity scores.
4. Use retrieved chunks as evidence for answer generation.
