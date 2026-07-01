# Nura Foundation Design

## Purpose

Build the first foundation slice for Nura RAG Copilot without starting the RAG implementation yet. This slice should give the project a clean repo, a working Next.js app, a Convex backend connection point, durable project instructions, and clear learning notes.

## Scope

This phase includes:

- Git repository initialization on the `main` branch.
- Next.js App Router scaffold with TypeScript, Tailwind CSS, ESLint, and a `src/` directory.
- Convex installed and configured enough for the app to compile and for later phases to add documents, chunks, vector indexes, and actions.
- `AGENTS.md` at the repo root with project rules, stack decisions, RAG safety rules, and definition of done.
- `.env.example` documenting required environment variables without storing secrets.
- A minimal first screen that identifies the project and shows the planned learning pipeline.
- A foundation learning note explaining what each major tool owns.

This phase does not include:

- Synthetic documents.
- Chunking logic.
- Embeddings.
- Vector indexes.
- Model calls.
- Ask-and-answer RAG flow.

## Architecture

Next.js owns the user interface and route structure. Convex owns persistent application data, backend functions, and later vector search. Model providers will be wrapped behind a small adapter in a later phase so Microsoft Foundry deployments can be used first and direct OpenAI access can remain a fallback.

The foundation keeps secrets out of the repo. Runtime credentials will live in local environment variables or Convex environment variables, with only names and examples documented in `.env.example`.

## Learning Outcomes

After this phase, Wasim should be able to explain:

- Why a repo needs `.gitignore`, `AGENTS.md`, and `.env.example`.
- What Next.js is responsible for in this app.
- What Convex is responsible for in this app.
- Why embeddings and answer models are not implemented before the scaffold is healthy.
- Why the embedding model is locked early while the answer model remains configurable.

## Stack Decisions

- App framework: Next.js App Router.
- Language: TypeScript.
- Styling: Tailwind CSS.
- Backend/database/vector store: Convex.
- Embedding model for later phases: `text-embedding-3-small` at 1536 dimensions.
- Answer model for later phases: GPT-4.1 through Microsoft Foundry, with GPT-4.1 mini as the lower-cost fallback if available.

## Verification

The foundation phase is complete when:

- The app dependencies install successfully.
- The app has a documented local run command.
- `npm run lint` passes.
- `npm run build` passes or any external-service blocker is documented clearly.
- The repo has a clean git status except intentional uncommitted work.
