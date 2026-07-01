# 03 - Embedding Readiness

## Previous Steps

In the foundation step, we created the app shell, project rules, environment documentation, and Convex backend location.

In the RAG visibility step, we created ten synthetic source documents, loaded them from disk, split them into heading-aware chunks, and showed those chunks in the UI. That made the future embedding input visible.

## How This Works In Normal RAG Systems

The human does not manually create every chunk. The usual workflow is:

1. Approved source documents are added to the system.
2. The application automatically loads those documents.
3. The application automatically chunks them using rules such as heading boundaries, paragraph boundaries, and target size.
4. A human reviews the chunk preview and checks whether the chunks are useful and safe.
5. Approved chunks are sent to an embedding model.
6. The resulting vectors are stored with the chunk text and metadata.
7. A user question is embedded with the same embedding model.
8. Vector search finds the chunks closest in meaning to the question.
9. The answer model receives those chunks and must cite them.

Some systems use model-assisted parsing for complex files, but the core chunking step is still part of the application pipeline. It should be repeatable and inspectable.

## What We Built In This Step

We added embedding readiness, not real embeddings yet:

- Central embedding config in `src/lib/rag/embedding-config.ts`.
- Vector dimension validation in `src/lib/rag/vector-validation.ts`.
- Tests proving correct and incorrect vector lengths.
- A dashboard card showing the chosen embedding model and vector size.

This is the bridge between chunk preview and real vector storage.

## Vector Dimensions

An embedding is a list of numbers. The number of values in the list is the vector dimension count.

Tiny teaching example:

```ts
const teachingVector = [0.12, -0.04, 0.88, 0.03];
```

That vector has 4 dimensions because it has 4 numbers.

Our real embedding model choice is `text-embedding-3-small`, configured for 1536 dimensions. A future chunk embedding will conceptually look like:

```ts
{
  chunkId: "return_policy__chunk_001",
  source: "return_policy.md",
  embedding: [number, number, number /* ...1536 total numbers */]
}
```

The important rule is that stored chunk vectors and query vectors must use the same model and same dimension count. If stored chunks have 1536 numbers, the question embedding must also have 1536 numbers.

## Current Step

This step prepares the app to enforce that rule. We can now validate a vector before storage or search:

- 1536 numbers: accepted.
- 3 numbers: rejected.
- 3072 numbers: rejected for this project unless we intentionally change the index design.

## Next Step

The next real build step is credentials and storage:

1. Run `npx convex dev` interactively to configure Convex.
2. Add the Microsoft Foundry or Azure OpenAI embedding deployment values.
3. Generate embeddings for the visible chunks.
4. Store chunk text, metadata, and embeddings.
5. Add vector search for a question embedding.
