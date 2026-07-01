# Grounded Answer Generation Design

## Purpose

Move Nura from retrieval visibility to grounded answer generation.

The previous phase proved that a user question can be embedded, searched against Convex chunk vectors, and shown as ranked evidence. This phase uses that retrieved evidence to generate a final support-style answer with `gpt-5.4-mini`.

The learning goal is to separate the two jobs clearly:

- Retrieval finds candidate evidence.
- Answer generation explains that evidence in useful language.

## Approved Direction

Use retrieval-first grounded generation.

For each submitted question, the system should:

1. Embed the question with `text-embedding-3-small`.
2. Retrieve the top 5 stored chunks from Convex vector search.
3. Build a compact evidence prompt from those chunks.
4. Call the configured Microsoft Foundry chat deployment, `gpt-5.4-mini`.
5. Return an answer that only uses retrieved evidence.
6. Show the answer and the cited evidence chunks in the dashboard.

This phase should use the OpenAI-compatible Chat Completions shape because it is simple, stateless, and matches the current `/openai/v1/` endpoint style already used for embeddings.

## Scope

This phase includes:

- A shared answer-generation provider helper for the Foundry chat deployment.
- Prompt assembly from retrieved chunks.
- A Convex action that retrieves chunks and generates a grounded answer.
- A dashboard answer panel with cited evidence.
- A refusal path when retrieval has no usable evidence.
- Learning notes explaining grounded generation and citation behavior.

This phase does not include:

- Streaming responses.
- Multi-turn chat history.
- User-uploaded documents.
- Hybrid keyword plus vector retrieval.
- Reranking.
- Human eval datasets.
- Authentication, authorization, billing, or deployment.

## Score Explanation

The retrieval score is a vector similarity score.

It is useful as a relevance signal because it measures how close the question vector is to a chunk vector. It is not a truth score, confidence score, or guarantee that the chunk fully answers the question.

The UI should keep showing the score because it helps debug retrieval quality, but the final answer should cite chunk sources and sections rather than presenting the score as proof.

## Architecture

Keep Convex as the server-side AI boundary.

The flow becomes:

```text
Question
  -> Convex action
  -> Foundry embedding call
  -> Convex vector search
  -> retrieved chunks
  -> prompt builder
  -> Foundry chat completion call
  -> grounded answer + citations
  -> dashboard
```

The existing retrieval action can stay as a visibility/debug action. Add a new grounded answer action so retrieval-only and answer-generation flows remain independently understandable.

## Prompt Contract

The prompt should be strict and small.

System instructions:

- You are Nura's support copilot.
- Answer only from the provided evidence.
- Do not invent policies, product facts, numbers, timelines, or exceptions.
- If the evidence is insufficient, say that the evidence does not contain enough information.
- Include source references using the provided citation labels.

Evidence format:

```text
[1] return_policy.md > Standard Return Window
Chunk ID: return_policy__chunk_002
Score: 0.707
Text: ...
```

User prompt:

```text
Question: Can a customer return an opened product?
Use the evidence above to answer clearly and concisely.
```

## Answer API

Add a public Convex action:

```ts
generateGroundedAnswer({
  question: string;
  limit?: number;
})
```

Return:

```ts
{
  question: string;
  answer: string;
  answerModel: string;
  retrieval: {
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
      citationLabel: string;
    }>;
  };
}
```

Use the configured `AZURE_OPENAI_CHAT_DEPLOYMENT` as the chat model name. Use the existing `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY`. Do not expose API keys or raw provider responses in the UI.

## UI

Keep the current cream, white, navy, and near-black palette.

Evolve the retrieval panel into an answer workspace:

- Question input.
- Primary button: "Generate answer".
- A final answer panel above the evidence list.
- Citation chips or source references that map to retrieved chunks.
- The retrieved evidence list remains visible below the answer.
- Empty state before a question.
- Setup state before embeddings exist.
- Error state for provider or configuration failures.

The answer panel should look premium and product-like, not like raw debug output. The evidence list should still be inspectable because the project is learning-first.

## Refusal Behavior

If retrieval returns no chunks, the action should not call the answer model. It should return a clear insufficient-evidence answer.

If retrieved chunks exist but do not contain enough information, the prompt should instruct the model to say so. This phase will rely on prompt discipline rather than a separate reranker or threshold gate.

## Error Handling

Handle these cases explicitly:

- Empty question: show a validation message.
- Missing embeddings: show that the embedding step must run first.
- Missing Foundry endpoint, key, embedding deployment, or chat deployment: return a safe setup error.
- Embedding request failure: return a safe provider error.
- Chat completion failure: return a safe provider error.
- Chat response has no text: return a safe provider error.

## Testing

Use TDD for local boundaries:

- Prompt builder formats evidence with stable citation labels.
- Answer request helper parses chat completion text.
- Empty retrieval skips the answer provider and returns an insufficient-evidence answer.
- Dashboard renders answer, cited evidence, error state, and setup state.

The real Foundry answer call should be verified manually through Convex after the action is deployed because it depends on external credentials and quota.

## Learning Outcomes

After this phase, Wasim should be able to explain:

- Why RAG answers should be generated after retrieval, not before.
- Why the answer model should see only the retrieved evidence.
- Why similarity score helps debug retrieval but is not a truth score.
- Why citations should point to source chunks.
- Why refusal is a product feature, not a failure, when evidence is missing.
