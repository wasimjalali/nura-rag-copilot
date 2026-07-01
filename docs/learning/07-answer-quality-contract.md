# 07 - Answer Quality Contract

## Previous Step

We already had grounded answer generation:

1. Embed the user question.
2. Retrieve relevant chunks from Convex.
3. Send the chunks to `gpt-5.4-mini`.
4. Show the generated answer with cited evidence.

That proved the RAG loop works end to end.

## What Changed In This Step

The answer is no longer treated as only loose text.

The model now returns a structured answer:

```ts
{
  answerType: "grounded" | "insufficient_evidence";
  paragraphs: Array<{
    text: string;
    citations: string[];
  }>;
}
```

The app parses and validates this structure before rendering.

## Why Plain Text Is Not Enough

A plain text answer is easy to display, but hard to trust.

The model might:

1. Put all citations at the end.
2. Forget a citation.
3. Cite a chunk that was not retrieved.
4. Mix supported and unsupported claims in one paragraph.

That makes the UI look grounded even when the answer is weak.

## Why Structured Output Helps

With a structured contract, the app can check the answer before showing it.

For grounded answers:

1. Every paragraph must have text.
2. Every paragraph must have at least one citation.
3. Every citation must match a retrieved chunk label such as `[1]`.
4. Duplicate citations inside a paragraph are removed.

If any of those checks fail, the app falls back to insufficient evidence.

## Paragraph-Level Citations

Each paragraph carries the citations that support that paragraph.

Example:

```text
Opened products may be returned within 30 days when the customer tried the product and is unsatisfied. [1]

Orders outside the 30-day window are not eligible for standard returns. [2]
```

This is better than one citation list at the end because the support agent can verify each claim locally.

## Safe Fallback

If the model returns invalid JSON, unsupported citations, empty paragraphs, or grounded paragraphs without citations, the app returns:

```text
I do not have enough retrieved evidence to answer that question.
```

This is intentional. A production RAG system should prefer a safe refusal over a polished but unsupported answer.

## Current Flow

```text
Question
  -> question embedding
  -> Convex vector search
  -> ranked chunks with citation labels
  -> structured JSON answer prompt
  -> model JSON response
  -> parser and citation validator
  -> paragraph-level answer UI
```

## Next Step

The next phase should research and design the premium support-agent chat workspace:

1. Main chat interface.
2. Sidebar navigation.
3. Citation interactions.
4. Evidence drawer.
5. Retrieval Lab as a separate debug page.
