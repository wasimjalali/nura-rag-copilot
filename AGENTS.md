# Nura RAG Copilot Agent Guide

## Purpose

Nura RAG Copilot is Project 01 in Wasim's AI Specialist to Agentic AI Engineer learning path. The goal is to build a useful support copilot while learning the RAG loop directly: documents, chunks, embeddings, vector search, retrieval, grounded prompting, citations, refusals, and manual evals.

## Stack

- Frontend: Next.js App Router with TypeScript.
- Styling: Tailwind CSS v4 with role-named design tokens.
- Backend/database/vector search: Convex.
- Embeddings: `text-embedding-3-small` at 1536 dimensions.
- Answer model: `gpt-5.4-mini` through Microsoft Foundry.

## Safety Rules

- Use synthetic documents only.
- Do not use employer documents, customer data, confidential files, Nature Heart IP, or real customer data.
- Do not store secrets in the repo.
- Do not read `.env`, `.env.*`, `.env.local`, `.env.convex`, or any file that may contain API keys. If a secret value is needed, ask Wasim to run a command locally instead.
- Do not provide medical advice.
- Do not claim that supplements cure, treat, diagnose, or prevent disease.

## RAG Rules

- Keep retrieval visible in the UI.
- Show source document, section heading when available, chunk id, and retrieved chunk text.
- Every answer must cite the chunks it used.
- If evidence is missing, say the documents do not provide enough information.
- Build the core RAG loop directly before adding frameworks.

## Non-Goals For Project 01

- No LangChain, LangGraph, CrewAI, agents, reranking, hybrid search, GraphRAG, fine-tuning, customer account integrations, real employer documents, or real customer data unless Wasim explicitly changes scope.

## Development Workflow

- Work in small milestones.
- Explain the learning purpose of each milestone.
- Verify each step before moving to the next.
- Keep README and learning notes updated.
- Prefer test-first development for custom behavior.
- For Next.js-specific changes, follow the installed/current App Router documentation instead of relying on older framework memory.

## Definition Of Done For Project 01

- [x] Synthetic docs are loaded.
- [x] Chunks are visible.
- [x] Embeddings are stored.
- [x] Convex vector retrieval works.
- [x] Answers are grounded with citations.
- [x] Unsupported claims are refused.
- [x] Ten manual eval questions are included (`src/lib/eval/manual-eval-set.ts`).

## Interface

The core RAG loop is wrapped in a premium, production-ready workspace UI: a chat
view with inline citations and an on-demand sources panel, plus knowledge base,
retrieval, evaluations, and settings views. All visual work follows the
`design-craft` discipline and role-named tokens in `src/app/globals.css`.
