# Nura RAG Copilot

A grounded support copilot that answers only from retrieved evidence and cites every source. If the documents do not cover a question, it says so instead of guessing.

Nura is Project 01 in a learning path from AI Specialist to Agentic AI Engineer. It builds the core retrieval-augmented generation (RAG) loop from scratch, without frameworks, so every step is visible: documents, chunks, embeddings, vector search, grounded prompting, citations, refusals, and manual evals. On top of that loop sits a production-grade, premium chat interface.

> Status: private while in development. It will be open-sourced later.

## What it does

- **Grounded answers only.** Every reply is drawn from retrieved chunks of the knowledge base and carries paragraph-level citations.
- **Visible retrieval.** The exact chunks behind an answer are one click away, with their source, section, similarity score, and full text.
- **Honest refusals.** When the evidence is missing, Nura returns an insufficient-evidence response rather than inventing an answer, and it never gives medical advice.
- **A real workspace.** Chat, a knowledge base with document and chunk inspection, a retrieval view, a manual evaluation battery, and settings, all in one clean UI.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS v4 with role-named design tokens |
| Backend, database, vector search | Convex |
| Embeddings | `text-embedding-3-small` at 1536 dimensions |
| Answer model | `gpt-5.4-mini` via Microsoft Foundry |
| Tests | Vitest + Testing Library |

## Interface

The UI is a three-zone workspace: a quiet left navigation rail, the active view in the center, and an on-demand evidence panel on the right.

- **Chat** - an LLM-style conversation with a floating composer, inline citations, an animated "what the model is doing" sequence while it works, and related follow-up questions after each answer.
- **Sources panel** - opens from an answer's Sources button and shows only the chunks that answer actually cited. Each opens a modal with the full chunk, score, rank, and token estimate.
- **Knowledge base** - source documents and their chunks, with actions to add a synthetic document and to store and embed the corpus.
- **Retrieval** - how chunks become vectors and how questions find them, plus live storage status.
- **Evaluations** - the manual evaluation battery of ten questions, each targeting one behavior: grounding, guardrails, retrieval, or visibility.
- **Settings** - the models, storage, and guardrails behind every answer.

## How the RAG loop works

1. **Load** synthetic support documents from `content/synthetic-docs`.
2. **Chunk** each document by section heading into retrievable passages with token estimates.
3. **Embed** every chunk with `text-embedding-3-small` and store the 1536-dimension vectors in Convex.
4. **Retrieve** the top matches for a question through Convex vector search.
5. **Ground** the answer by prompting `gpt-5.4-mini` with only the retrieved chunks, labeled `[1]`, `[2]`, and so on.
6. **Validate** that every paragraph cites real retrieved chunks, and fall back to an insufficient-evidence response when it cannot.

## Getting started

### Prerequisites

- Node.js 20 or newer
- A Convex account (free tier is fine for this project)
- Access to a Microsoft Foundry deployment for embeddings and chat

### Install

```bash
npm install
```

### Configure Convex

Convex needs one interactive setup step. Run it once to log in, create a dev deployment, and generate the TypeScript bindings under `convex/_generated`:

```bash
npx convex dev
```

### Configure secrets

Copy the example environment file and fill in your own values. Never commit real secrets; `.env` files are gitignored.

```bash
cp .env.example .env
```

Foundry and Convex secret setup is documented in `docs/setup/01-convex-foundry-secrets.md`.

### Run

```bash
npm run dev
```

Open the app, go to Knowledge base or Retrieval, run "Store and embed chunks" once, then ask a question in Chat.

### Verify

```bash
npm test
npm run lint
npm run build
```

## Project structure

```
convex/                 Convex backend: schema, storage, embedding, retrieval, answer actions
content/synthetic-docs/ Ten synthetic support documents (the only data source)
src/app/                Next.js App Router: page, layout, server actions, global styles, favicon
src/components/         UI: workspace dashboard, logo, icon set
src/lib/rag/            The RAG loop: loading, chunking, embedding config, retrieval, grounded answer
src/lib/eval/           The manual evaluation battery
docs/                   Dated build journal: learning notes, design specs, and plans per milestone
```

## Evaluations

The manual evaluation set lives in `src/lib/eval/manual-eval-set.ts` and is rendered in the Evaluations view. Each case names the question and the behavior it checks, so the copilot can be reviewed by hand against grounding, refusal, retrieval, and source-visibility expectations.

## Safety and guardrails

- Synthetic documents only. No employer data, customer data, confidential files, or real customer records.
- No secrets in the repo. `.env` files are gitignored and never read by tooling.
- No medical advice, and no claims that supplements cure, treat, diagnose, or prevent disease.
- Answers must cite their evidence, and missing evidence yields a refusal rather than a guess.

## Learning journey

`docs/` is a point-in-time record of how each milestone was designed and built:

- `docs/learning/` - one note per milestone explaining the learning purpose
- `docs/superpowers/specs/` - the validated design for each milestone
- `docs/superpowers/plans/` - the implementation plan for each milestone
- `docs/research/` - UI and product research

## License

Private for now. A license will be added when the project is open-sourced.
