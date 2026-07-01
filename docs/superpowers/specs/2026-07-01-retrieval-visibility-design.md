# Retrieval Visibility Design

## Purpose

Move Nura from stored embeddings to visible retrieval.

This phase teaches the core RAG step that happens before answer generation: a user question is embedded into the same vector space as the document chunks, Convex searches for nearby chunk vectors, and the UI shows the ranked chunks with similarity scores.

The goal is not to make the copilot answer yet. The goal is to make the retrieval evidence understandable.

## Approved Direction

Build retrieval visibility only.

The user can type or submit a sample question. The system embeds that question with the configured Microsoft Foundry embedding deployment, runs Convex vector search over stored chunk embeddings, and shows the top matching chunks. Answer generation with `gpt-5.4-mini` comes after this phase.

## Scope

This phase includes:

- A Convex vector index on `documentChunks.embedding`.
- A retrieval action that embeds the user question through Microsoft Foundry.
- Query-vector validation against the locked 1536-dimension embedding size.
- Fetching the matching chunk records after vector search returns IDs and scores.
- A retrieval panel in the dashboard with a question form and ranked chunk results.
- Learning notes explaining how question embeddings, vector search, and similarity scores fit together.

This phase does not include:

- Final AI answer generation.
- Prompt assembly for the answer model.
- Citation rendering in a generated answer.
- Chat history.
- Hybrid keyword plus vector search.
- Reranking.
- User-uploaded documents.
- Production authentication or authorization.

## Architecture

The existing document ingestion path remains unchanged: synthetic documents are loaded, chunked, reviewed, stored in Convex, and embedded with `text-embedding-3-small`.

This phase adds the retrieval path:

1. The user submits a question from the dashboard.
2. A Next.js server action calls a Convex retrieval action.
3. The Convex action calls the Microsoft Foundry embeddings endpoint with the question text.
4. Convex validates the returned query vector has 1536 dimensions.
5. Convex runs vector search against the `documentChunks` vector index.
6. Convex fetches the matched chunk records by ID.
7. The dashboard shows ranked results with score, source, section, and chunk text.

Convex vector search runs from actions, so the retrieval action should own both the provider call and the vector search. Fetching full chunk records should happen through an internal query because actions do not directly use `ctx.db`.

## Data Model

Update `documentChunks.embedding` to the vector-index-compatible validator:

```ts
embedding: v.optional(v.array(v.float64()))
```

Add a vector index to `documentChunks`:

```ts
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,
})
```

Keep the existing metadata fields:

```ts
embeddingModel?: string;
embeddingDimensions?: number;
embeddedAt?: number;
```

The current source and chunk indexes remain useful for storage and inspection. This first retrieval phase does not need vector filter fields because the starting behavior is global retrieval across all stored synthetic chunks.

## Retrieval API

Add a public Convex action:

```ts
retrieveRelevantChunks({
  question: string;
  limit?: number;
})
```

Return a typed result:

```ts
{
  question: string;
  embeddingModel: string;
  embeddingDimensions: 1536;
  results: Array<{
    rank: number;
    score: number;
    chunkId: string;
    source: string;
    section: string;
    text: string;
    tokenEstimate: number;
  }>;
}
```

Use a conservative default limit of 5 results. Clamp the accepted limit to a small range, such as 1 through 10, so the UI and provider usage stay predictable.

## UI

Keep the cream background, white cards, navy accents, and near-black text.

Add a retrieval panel to the current dashboard:

- A question input.
- A primary action button to retrieve chunks.
- A compact explanation label such as "Retrieved evidence" rather than "Answer".
- A ranked result list showing score, source, section, and chunk preview text.
- An empty state when no question has been submitted.
- A setup state when chunks are not embedded yet.

The UI should make it clear that these are candidate evidence chunks, not the final answer. This helps keep the learning sequence honest: first inspect retrieval, then generate an answer from retrieved evidence in the next phase.

## Error Handling

Handle these cases explicitly:

- Empty question: show a validation message and do not call the provider.
- Missing embedding configuration: return a safe setup error without secret values.
- Missing stored embeddings: show that the previous embedding step must run first.
- Foundry request failure: show a safe provider error.
- Query vector dimension mismatch: reject the retrieval and report the expected 1536 dimensions.
- Vector search returns IDs for records that no longer exist: skip missing records and keep the remaining ranked results stable.

## Testing

Use TDD for the local boundaries:

- A retrieval helper clamps result limits.
- A retrieval helper maps vector-search scores plus chunk records into stable ranked results.
- Question validation rejects empty or whitespace-only input.
- UI renders the retrieval panel empty state and result list.

The real provider call and Convex vector search should be manually verified after the vector index is deployed, because they depend on the configured Convex deployment and Foundry API key.

## Learning Outcomes

After this phase, Wasim should be able to explain:

- Why the question must be embedded before retrieval.
- Why the question vector and chunk vectors must have the same dimensions.
- What vector similarity search returns.
- Why retrieval results are evidence candidates, not final answers.
- Why seeing chunks before answer generation makes a RAG system easier to debug.
