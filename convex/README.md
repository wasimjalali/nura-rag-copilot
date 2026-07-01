# Convex Backend

This directory holds Nura's Convex backend: the schema, storage mutations, and the actions that power embedding, retrieval, and grounded answers.

## Schema

`schema.ts` defines four tables:

- `sourceDocuments` - one row per synthetic document, with a content hash and word count.
- `documentChunks` - the chunked passages, each with its embedding, embedding model, dimension count, and a vector index (`by_embedding`, 1536 dimensions) for similarity search.
- `embeddingRuns` - a log of each store-and-embed run and its status.
- `projectNotes` - notes keyed by phase.

## Functions

- `ragStorage.ts` - storage status query plus mutations to upsert documents and chunks, start and finish embedding runs, and save embeddings.
- `ragEmbedding.ts` - embeds reviewed chunks through Microsoft Foundry and stores the 1536-dimension vectors.
- `ragRetrieval.ts` - embeds a question and runs Convex vector search to return ranked chunks with scores.
- `ragAnswer.ts` - generates a grounded answer with `gpt-5.4-mini`, labels retrieved chunks as citations, and falls back to an insufficient-evidence response when needed.
- `answerProvider.ts` / `embeddingProvider.ts` - Foundry request helpers and config readers.

## Interactive setup

Run this once to log in, create a dev deployment, write local Convex settings, and generate `convex/_generated/`:

```bash
npx convex dev
```

After setup, commit the generated Convex files so the project typechecks consistently.
