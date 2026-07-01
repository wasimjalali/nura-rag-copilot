# Nura RAG Copilot

Nura RAG Copilot is a learning-first RAG support assistant for a synthetic supplement e-commerce company.

## Current Phase

Answer quality contract:

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
- Convex vector index over stored chunk embeddings
- Real question embedding through Microsoft Foundry
- Retrieval action that returns ranked chunks and scores
- Premium dashboard panel for inspecting retrieved evidence
- Grounded answer action using `gpt-5.4-mini`
- Evidence prompt with citation labels
- Premium answer panel with cited retrieved chunks
- Structured answer contract with paragraph-level citations
- Citation validation against retrieved chunk labels
- Safe insufficient-evidence fallback for malformed or unsupported answers

## Planned RAG Pipeline

1. Synthetic documents
2. Chunking and chunk preview
3. Embeddings
4. Convex vector search and retrieval visibility
5. Grounded answer generation with cited evidence
6. Answer quality contract with paragraph-level citations
7. Premium chat UI research and design
8. Manual evals

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
