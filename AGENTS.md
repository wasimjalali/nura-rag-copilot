# Nura RAG Copilot Agent Guide

## Purpose

Nura RAG Copilot is Project 01 in Wasim's AI Specialist to Agentic AI Engineer learning path. The goal is to build a useful support copilot while learning the RAG loop directly: documents, chunks, embeddings, vector search, retrieval, grounded prompting, citations, refusals, and manual evals.

## Stack

- Frontend: Next.js App Router with TypeScript.
- Styling: Tailwind CSS.
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

- Synthetic docs are loaded.
- Chunks are visible.
- Embeddings are stored.
- Convex vector retrieval works.
- Answers are grounded with citations.
- Unsupported claims are refused.
- Ten manual eval questions are included with observations.
