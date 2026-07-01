# Nura RAG Copilot

Nura RAG Copilot is a learning-first RAG support assistant for a synthetic supplement e-commerce company.

## Current Phase

Real embedding storage:

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
- Convex source document and chunk storage
- Real Microsoft Foundry embedding action
- 1536-dimension validation before vectors are stored
- Storage status panel in the dashboard

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

For Foundry and Convex secret setup, use the commands in `docs/setup/01-convex-foundry-secrets.md`.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Safety

This project uses synthetic documents only. Do not add employer data, customer data, confidential files, or secrets.
