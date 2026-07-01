# Embedding Readiness Design

## Purpose

Prepare Nura for the embeddings phase without calling Microsoft Foundry, OpenAI, or Convex yet. This phase teaches the handoff from visible chunks to vectors: approved chunks become fixed-length numeric embeddings, and those embeddings must match the vector index dimensions.

## Workflow Summary

The normal RAG workflow is:

1. A human or admin provides approved source documents.
2. The application ingests those documents automatically.
3. The application chunks the documents automatically using deterministic rules or a document-processing service.
4. A human reviews the chunk preview for obvious problems.
5. Approved chunks are embedded by an embedding model.
6. Chunk text, metadata, and embedding vectors are stored in a vector-capable database.
7. A user question is embedded with the same model.
8. Vector search returns the most similar chunks.
9. The answer model receives the retrieved chunks and cites them.

The human in the loop does not manually write every chunk. The human verifies that the automatic chunking process produced useful, safe, and source-grounded chunks.

## Scope

This phase includes:

- A central embedding configuration for model name, dimensions, provider, and deployment variable names.
- Vector dimension validation utilities.
- Tests proving that 1536-dimension vectors pass and mismatched vectors fail.
- UI copy that explains the next embedding step from the current chunks.
- A learning note summarizing the pipeline and vector dimension rule.

This phase does not include:

- Real Microsoft Foundry API calls.
- Real OpenAI API calls.
- Convex writes.
- Convex vector indexes.
- Retriever logic.
- Answer generation.

## Architecture

`src/lib/rag/embedding-config.ts` owns the chosen embedding settings. `src/lib/rag/vector-validation.ts` owns simple safety checks that later storage code can reuse before inserting or searching vectors.

The RAG visibility dashboard receives an embedding summary so the UI can show the selected model and dimensions next to the current chunk count.

## Data Shape

```ts
type EmbeddingConfig = {
  provider: "azure-openai";
  model: "text-embedding-3-small";
  dimensions: 1536;
  deploymentEnvVar: "AZURE_OPENAI_EMBEDDING_DEPLOYMENT";
};
```

## Testing

Tests should verify:

- The configured model is `text-embedding-3-small`.
- The configured dimension count is `1536`.
- A vector with 1536 numbers passes validation.
- A vector with a different length fails validation with a useful message.

## Learning Outcomes

After this phase, Wasim should be able to explain:

- Chunking is automatic application behavior, not manual copy-paste.
- Human review checks chunk quality before embeddings.
- Embeddings are numeric vectors created from chunk text.
- Vector dimensions must match between stored chunks and query embeddings.
- We can prepare the software boundary before connecting real credentials.
