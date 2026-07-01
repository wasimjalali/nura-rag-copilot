# 02 - RAG Visibility

## What We Built

We added the first knowledge base for Nura: ten synthetic markdown documents, a document loader, a heading-aware chunker, and a dashboard that shows both documents and generated chunks.

This phase still does not create embeddings. That is intentional. Before a RAG system turns text into vectors, we need to see exactly which text units will be embedded.

## Documents

Documents are the raw source material. In this project they live in `content/synthetic-docs/` and are fictional company policies, product notes, and support procedures.

Examples:

- `return_policy.md`
- `product_catalog.md`
- `health_claims_compliance.md`
- `support_escalation_sop.md`

These files are the approved knowledge base for the assistant. If a fact is not in these documents, the assistant should not invent it later.

## Chunks

Chunks are smaller pieces of documents. RAG systems usually embed chunks instead of whole documents because a whole policy file can contain many unrelated ideas.

For example, `return_policy.md` contains standard returns, discomfort reports, non-returnable orders, and refund processing. If we embed the whole file as one vector, a question about stomach discomfort may retrieve too much unrelated return information. If we embed heading-aware chunks, retrieval can find the exact section more easily.

## Metadata

Every chunk keeps metadata:

- `id`: stable chunk id, such as `return_policy__chunk_001`
- `source`: original document file, such as `return_policy.md`
- `section`: heading, such as `Discomfort Or Adverse Experience`
- `text`: the actual chunk content
- `tokenEstimate`: rough size estimate
- `createdAt`: stable preview timestamp for this phase

Metadata is what lets the future answer say, "I used this source." Without metadata, the assistant might answer correctly but fail to prove where the answer came from.

## Vector Dimensions

An embedding is a list of numbers that represents meaning.

Example:

```ts
const chunkText =
  "Opened products may be returned within 30 days when the customer is unsatisfied.";

const embedding = [0.12, -0.04, 0.88, 0.03]; // tiny teaching example
```

That teaching example has 4 dimensions because it has 4 numbers. Real embeddings are much longer. Our chosen embedding model, `text-embedding-3-small`, produces 1536 numbers by default.

That means a future chunk record will look conceptually like this:

```ts
{
  id: "return_policy__chunk_001",
  source: "return_policy.md",
  text: "Opened products may be returned within 30 days...",
  embedding: [number, number, number /* ...1536 total numbers */]
}
```

The query gets embedded with the same model:

```ts
const question = "Can a customer return an opened bottle?";
const questionEmbedding = [number, number, number /* ...1536 total numbers */];
```

Vector search compares the question vector to each chunk vector. Chunks with closer coordinates are treated as more semantically similar.

The key rule: vectors in the same index must have the same length. A 1536-dimension question vector can compare cleanly with 1536-dimension chunk vectors. It cannot compare correctly with a 4-dimension teaching vector or a 3072-dimension vector from a different setup.

## Why Chunk Size Matters

If chunks are too large, retrieval may bring back a lot of unrelated text. If chunks are too small, the assistant may lose the surrounding context needed to answer safely.

For this phase, the chunker targets medium-sized chunks and preserves markdown section headings. Later, we can evaluate whether the chunk sizes are good by asking test questions and inspecting retrieved chunks.

## What Comes Next

The next phase is embeddings and storage:

1. Generate an embedding for each visible chunk.
2. Store chunks and vectors.
3. Search for chunks using a question embedding.
4. Keep the retrieved chunks visible before generating answers.
