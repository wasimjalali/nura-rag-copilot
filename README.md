# Nura RAG Copilot

Nura RAG Copilot is a learning-first RAG support assistant for a synthetic supplement e-commerce company.

## Current Phase

Embedding readiness:

- Next.js app scaffold
- Convex backend location
- Project rules in `AGENTS.md`
- Environment variable example
- Foundation learning note
- Ten synthetic markdown documents
- Document loader
- Heading-aware chunking
- Chunk preview dashboard
- Tests for loading, chunking, and preview rendering
- Embedding model config for `text-embedding-3-small`
- Vector dimension validation for 1536-dimension embeddings
- Embedding readiness card in the dashboard

## Planned RAG Pipeline

1. Synthetic documents
2. Chunking and chunk preview
3. Embeddings
4. Convex vector search
5. Grounded answer generation
6. Citations and refusals
7. Manual evals

## Local Development

```bash
npm install
npm run dev
```

Convex setup requires one interactive step:

```bash
npx convex dev
```

Run it once to log in, configure the project, and generate Convex TypeScript bindings.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Safety

This project uses synthetic documents only. Do not add employer data, customer data, confidential files, or secrets.
