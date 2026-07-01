# RAG Visibility Design

## Purpose

Build the second Nura milestone: make the knowledge base and chunking process visible before embeddings or vector search are added. This phase teaches what a RAG system actually embeds: not whole documents, but smaller chunks with source metadata.

## Scope

This phase includes:

- Ten synthetic company markdown documents under `content/synthetic-docs/`.
- A TypeScript document loader that reads those markdown files from disk.
- A deterministic chunking module that splits markdown by headings and size limits.
- Chunk metadata including chunk id, source document name, section heading, text, and created timestamp.
- A Documents and Chunk Preview UI in the existing home page.
- A learning note explaining documents, chunks, metadata, and why chunk preview matters.
- Tests for document loading, heading extraction, chunk metadata, and chunk sizing.

This phase does not include:

- Embedding generation.
- Convex writes.
- Convex vector indexes.
- Microsoft Foundry or OpenAI API calls.
- Retriever logic.
- Answer generation.
- Citations in model answers.

## Architecture

The synthetic markdown files are the first knowledge base. A server-side library under `src/lib/rag/` loads those files, parses headings, and creates chunk objects. The home route remains a Server Component and passes documents/chunks into a presentational component for display.

The chunker will be deterministic: same input documents, same chunk ids and ordering. A fixed `createdAt` value is used in local preview data so tests and UI output stay stable. Later, when chunks are inserted into Convex, the storage layer can assign real creation timestamps.

## Data Shape

```ts
type KnowledgeDocument = {
  source: string;
  title: string;
  text: string;
};

type DocumentChunk = {
  id: string;
  source: string;
  section: string;
  text: string;
  tokenEstimate: number;
  createdAt: string;
};
```

`tokenEstimate` will be an approximate value based on words, not a tokenizer-specific count. That is enough for this phase because the goal is learning and visibility, not exact model budgeting.

## Chunking Rules

- Split each markdown document by `##` section headings.
- Preserve the section heading in chunk metadata.
- Target chunks at roughly 120 to 220 words.
- Split long sections by paragraph boundaries first.
- If a single paragraph is too long, split by sentences.
- Chunk ids use a stable format: `<source-without-extension>__chunk_<three-digit-number>`.

## UI Design

The home page will evolve from a foundation pipeline into a working RAG visibility dashboard:

- Top summary: project name, current milestone, and next milestone.
- Document list: source name, title, section count, and word count.
- Chunk preview: chunk id, source, section, token estimate, and chunk text.
- Learning callout: "This is what will be embedded in the next phase."

The UI should stay utilitarian and compact. No chat interface yet.

## Error Handling

If the content directory is missing or empty, the loader returns an empty list and the UI shows an empty state. Tests cover valid documents and chunking behavior; deployment-specific file access issues are handled by the build verification step.

## Testing

Tests should verify:

- Documents load with source, title, and text.
- The expected 10 synthetic source files exist.
- Chunk ids are stable.
- Section headings are captured.
- Chunk text is non-empty.
- Normal chunk sizes stay within the expected word range unless the source section itself is shorter.

## Learning Outcomes

After this phase, Wasim should be able to explain:

- Why RAG systems usually embed chunks instead of whole documents.
- Why every chunk needs source metadata.
- How heading-aware chunking improves retrieval debugging.
- Why chunk preview comes before embeddings.
- How changing chunk size can affect retrieval quality later.
