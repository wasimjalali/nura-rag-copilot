# Real Embedding Storage Design

## Purpose

Move Nura from chunk preview to real RAG storage. This phase takes the synthetic documents we already load and chunk, stores their chunks in Convex, calls the Microsoft Foundry OpenAI-compatible embedding endpoint, validates the returned vectors, and saves the embeddings for the next retrieval phase.

This is the first step where the RAG system stops being only visual and starts becoming operational.

## Approved Direction

Use real embedding API calls now. Do not add a fake or mock embedding path to the application workflow.

Tests may use small test doubles around pure boundaries, but the product path should call the configured Foundry deployment through Convex.

## Scope

This phase includes:

- Convex schema for source documents and document chunks.
- Storage fields for embedding vectors and embedding metadata.
- A Convex action that generates embeddings through Microsoft Foundry.
- Dimension validation before any embedding is stored.
- A small status surface in the UI showing whether chunks are previewed, stored, and embedded.
- Learning notes explaining the storage and embedding loop.

This phase does not include:

- Vector search for user questions.
- Grounded answer generation.
- Citation rendering from retrieved results.
- Reranking, hybrid search, GraphRAG, LangChain, or agent workflows.
- Non-synthetic documents.

## Architecture

The Next.js app remains responsible for loading and chunking synthetic markdown files for preview. Convex becomes the persisted RAG store.

The main boundary is:

1. Next.js loads synthetic documents.
2. Next.js chunks documents with the existing deterministic chunker.
3. A user-triggered UI action sends those chunk payloads to Convex.
4. Convex upserts source documents and chunks.
5. A Convex action calls Microsoft Foundry for embeddings.
6. Convex validates each vector has 1536 dimensions.
7. Convex stores the vector and metadata on the chunk record.

This keeps the same chunking logic visible and testable before the data enters Convex.

## Data Model

`sourceDocuments` should store one row per synthetic markdown file:

```ts
{
  source: string;
  title: string;
  textHash: string;
  wordCount: number;
  updatedAt: number;
}
```

`documentChunks` should store one row per generated chunk:

```ts
{
  chunkId: string;
  source: string;
  section: string;
  text: string;
  tokenEstimate: number;
  embedding?: number[];
  embeddingModel?: string;
  embeddingDimensions?: number;
  embeddedAt?: number;
  updatedAt: number;
}
```

The chunk table needs indexes for:

- Lookup by `chunkId` for idempotent upserts.
- Lookup by `source` for document inspection.

Vector search will be added in the next phase after embeddings exist.

## Embedding Provider

Use the existing Convex environment variables:

```text
AZURE_OPENAI_ENDPOINT=https://nura-rag-resource.services.ai.azure.com/openai/v1/
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_API_VERSION=v1
AZURE_OPENAI_API_KEY=<set by Wasim only>
```

The action should treat `AZURE_OPENAI_API_KEY` as required. If it is missing, the action should fail with a clear setup message and should not write partial embeddings.

## Error Handling

Handle these cases explicitly:

- Missing API key or endpoint: return a setup error.
- Foundry request fails: return an embedding provider error with no secret values.
- Returned vector length is not 1536: reject that chunk and report the mismatch.
- Some chunks already exist: update them idempotently instead of duplicating rows.
- Re-running the import: update documents/chunks and refresh embeddings safely.

## UI

Keep the current cream, white, navy, and near-black palette.

Add a compact storage status panel near the embedding readiness card:

- Preview chunks count.
- Stored chunks count.
- Embedded chunks count.
- Last embedding run status.

The UI should avoid showing secrets, raw request headers, or provider responses.

## Testing

Use TDD for the behavior we can test locally:

- Schema-adjacent payload builders map preview chunks into Convex-safe records.
- Vector dimension validation rejects wrong lengths before storage.
- Embedding status summaries count preview, stored, and embedded chunks correctly.
- UI renders the new status panel.

The real provider call will be verified manually through Convex after the API key is set, because it depends on external credentials and quota.

## Learning Outcomes

After this phase, Wasim should be able to explain:

- Why chunk preview and stored chunks are two different stages.
- Why embeddings should be generated server-side in Convex, not in the browser.
- Why real API keys stay in Convex environment variables.
- Why every stored vector must match the index dimension count.
- Why idempotent imports matter when rebuilding a RAG index.
