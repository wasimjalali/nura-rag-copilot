# 06 - Grounded Answer Generation

## Previous Steps

We already made retrieval visible:

1. The question is embedded with `text-embedding-3-small`.
2. Convex searches stored chunk vectors.
3. The dashboard shows ranked chunks, scores, source files, sections, and chunk text.

That taught us what evidence the system finds before an answer model writes anything.

## What Changed In This Step

This step adds the answer model.

The app now:

1. Retrieves the top evidence chunks.
2. Formats those chunks with citation labels such as `[1]`.
3. Sends the question and evidence to `gpt-5.4-mini`.
4. Instructs the model to answer only from the provided evidence.
5. Shows the final answer and the cited evidence together.

## What The Retrieval Score Means

The score is a vector similarity score. It is useful for debugging relevance because it tells us how close the question vector was to a chunk vector.

It is not a truth score.

A high score means the chunk is semantically close to the question. It does not guarantee that the chunk fully answers the question or that the final answer is correct. That is why the UI keeps the chunk text and citation visible.

## Why The Answer Model Receives Evidence

The answer model does not search Convex by itself in this phase. We search first, then give the model only the retrieved evidence.

That matters because the model's job is not:

```text
Know everything about the business.
```

Its job is:

```text
Explain the retrieved evidence clearly.
```

This is the core RAG pattern.

## Prompt Shape

The answer prompt includes:

- A system instruction that says to answer only from evidence.
- A list of retrieved chunks with citation labels.
- The user's question.

Example evidence block:

```text
[1] return_policy.md > Standard Return Window
Chunk ID: return_policy__chunk_002
Score: 0.707
Text: Opened products may be returned within 30 days...
```

The answer can then reference `[1]`, and the UI can show which chunk `[1]` means.

## Why Refusal Is Useful

If no evidence is retrieved, or if the evidence does not answer the question, the copilot should say it does not have enough information.

That is not a failure. In a production RAG system, refusal is a safety feature. It prevents the answer model from inventing policies, timelines, product facts, or exceptions.

## Current Flow

```text
Question
  -> question embedding
  -> Convex vector search
  -> ranked chunks
  -> citation-labeled evidence prompt
  -> gpt-5.4-mini
  -> grounded answer with cited evidence
```

## Next Step

The next phase should improve the product behavior around answers:

1. Add answer quality checks.
2. Add clearer citation interactions.
3. Add refusal examples.
4. Start a small manual eval set so we can measure whether answers are grounded and useful.
