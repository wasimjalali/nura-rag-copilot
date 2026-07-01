# 05 - Retrieval Visibility

## Previous Steps

We started by making the knowledge base visible: synthetic documents were loaded, split into stable chunks, and shown for review. Then we stored those chunks in Convex and generated real `text-embedding-3-small` vectors with 1536 dimensions.

At that point, every chunk had a meaning vector, but the app still could not search those vectors with a user question.

## What Changed In This Step

This step adds retrieval:

1. A user asks a question in the dashboard.
2. Convex sends that question to the same embedding model.
3. The model returns a 1536-dimension query vector.
4. Convex searches the chunk vector index for nearby vectors.
5. The app shows ranked evidence chunks with similarity scores.

The result is not an AI answer yet. It is the evidence that a future answer model will read.

## Why The Question Gets Embedded

Vector search compares vectors to vectors.

The stored chunks already have vectors. A plain text question does not. So the question must be converted into the same kind of vector before search can happen.

The important rule is:

```text
chunk embedding dimensions = question embedding dimensions = vector index dimensions
```

For this project, that number is always 1536.

If one side used 1536 dimensions and another used a different size, Convex could not compare them in the same vector index.

## What Convex Vector Search Returns

Convex vector search returns chunk document IDs and similarity scores. The retrieval action then fetches the full chunk records so the UI can show:

- Rank
- Score
- Source file
- Section
- Chunk ID
- Chunk text

The score helps us debug whether retrieval is finding plausible evidence. It is not a final truth score. It only describes similarity in the embedding space.

## Why We Stop Before Answer Generation

It is tempting to call the answer model immediately, but that hides the most important RAG debugging step.

If the retrieved chunks are wrong, the answer model will probably answer with weak or irrelevant context. By inspecting retrieval first, we can improve chunking, source content, filters, or retrieval strategy before asking `gpt-5.4-mini` to write the final response.

## Current Flow

```text
Question
  -> Microsoft Foundry embedding deployment
  -> 1536-dimension query vector
  -> Convex vector index over documentChunks.embedding
  -> ranked chunks with scores
  -> dashboard evidence panel
```

## Next Step

The next phase is grounded answer generation:

1. Take the retrieved chunks.
2. Build a compact prompt with those chunks as evidence.
3. Ask `gpt-5.4-mini` to answer using only that evidence.
4. Show citations or source references from the chunks.
5. Refuse or ask for clarification when retrieval does not provide enough evidence.
