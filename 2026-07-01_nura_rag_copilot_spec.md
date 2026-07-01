# Nura RAG Copilot - Project 01 Spec

## Project Summary

Nura RAG Copilot is a realistic customer-support and internal-operations assistant for a synthetic supplement e-commerce company. It answers questions from company documents, shows citations, and refuses to make unsupported medical or policy claims.

The project exists for two goals:

1. Build a useful RAG product that a small or medium e-commerce company could understand immediately.
2. Learn the first production-relevant RAG loop by building it directly: documents, chunks, embeddings, vector store, retriever, grounded prompt, citations, and manual eval.

## Learning Purpose

This project is part of Wasim's AI Specialist -> Agentic AI Engineer path. The goal is learning by building: ship a useful product while understanding every important RAG component well enough to explain, debug, and later extend it into more advanced agentic systems.

Project 01 should stay narrow on purpose. It is not the agent framework project yet; it is the foundation that makes later agentic engineering work stronger because Wasim will understand retrieval, grounding, citations, evals, and failure modes from first principles.

## Why This Project

Supplement e-commerce is a strong first RAG domain because support teams often need answers from scattered documents:

- Return and refund rules
- Shipping policies
- Product facts
- Ingredient and allergen information
- Subscription cancellation rules
- Customer-support escalation procedures
- Compliance rules about what the company can and cannot claim

The project is close to Wasim's real-world work context, but it must use synthetic documents only. No employer documents, internal files, confidential policies, customer data, or Nature Heart IP should be used.

## Product Name

**Nura RAG Copilot**

Short name: **Nura**

Why this name:

- Simple to pronounce.
- Feels clean and premium.
- Short enough to feel like a real product.
- Warm and clean without sounding like a medical claim.

## Target User

Primary user:

- Customer support agents at a supplement e-commerce company.

Secondary user:

- Operations managers who want fast answers from policy and product documents.

## Core Use Case

A support agent asks:

> Can a customer return an opened magnesium bottle after 20 days if they say it caused stomach discomfort?

The assistant should:

1. Retrieve the relevant return policy, product safety note, and health-claim policy chunks.
2. Answer only from those chunks.
3. Show citations under the answer.
4. Avoid medical advice.
5. Suggest escalation if the documents require it.

## MVP User Story

As a support agent, I want to ask questions about company policies and products so that I can answer customers faster while staying grounded in approved company information.

## MVP Features

### 1. Synthetic Knowledge Base

Create 8 to 10 synthetic company documents:

- `return_policy.md`
- `shipping_policy.md`
- `subscription_policy.md`
- `product_catalog.md`
- `ingredient_glossary.md`
- `allergen_policy.md`
- `supplement_usage_faq.md`
- `health_claims_compliance.md`
- `support_escalation_sop.md`
- `discount_refund_approval_rules.md`

Each document should contain realistic but fictional company information.

### 2. Document Ingestion

The app should load the synthetic documents, store the original source name, and split the content into chunks.

Each chunk should save:

- Chunk text
- Source document name
- Section heading if available
- Chunk id
- Created timestamp

### 3. Chunk Preview

The app should show the created chunks before embedding.

Purpose:

- Teach how chunk size affects retrieval.
- Make debugging visible.
- Avoid treating RAG as magic.

### 4. Embeddings

Each chunk should be converted into an embedding.

Plain explanation:

- The text becomes a list of numbers that represents meaning.
- Similar meanings should land close together during vector search.

Preferred embedding model for Project 01:

**`text-embedding-3-small` with 1536 dimensions**, deployed through Microsoft Foundry or Azure OpenAI if available in Wasim's setup.

Reason:

- The embedding model should be locked early because it affects stored vector dimensions and whether documents need to be re-embedded later.
- `text-embedding-3-small` keeps cost and latency low while staying strong enough for a focused text RAG project.
- 1536 dimensions fits Convex vector search cleanly.

### 5. Vector Store

The vector store should save embeddings with source metadata.

Recommended first implementation:

- Use Convex as the application database, backend function layer, and vector search store.

Preferred choice for this project:

**Convex vector search**, because it is generous for a learning project, keeps the TypeScript stack simple, and lets the app store chunks, metadata, embeddings, eval records, and retrieval results in one backend.

Implementation note:

- The answer model should stay configurable through a small provider adapter.
- Start with **GPT-4.1** through Microsoft Foundry if available.
- Use **GPT-4.1 mini** as the lower-cost fallback if it is available in Wasim's Foundry deployment.
- Skip GPT-5.4 mini for the first milestone unless Wasim explicitly decides to compare it later.

### 6. Retriever

When a user asks a question:

1. Embed the user question.
2. Search the vector store.
3. Return the top 4 to 6 chunks.
4. Display the retrieved chunks in the UI.

The retrieved chunks should be visible so Wasim can learn why the assistant answered the way it did.

### 7. Grounded RAG Prompt

The answer prompt should include strict rules:

```text
You are Nura, a support copilot for a supplement e-commerce company.
Answer only using the retrieved context.
If the context does not contain the answer, say that the documents do not provide enough information.
Do not provide medical advice.
Do not claim that a supplement cures, treats, diagnoses, or prevents disease.
For safety concerns, recommend contacting a qualified professional or escalating to the support team according to the documents.
Always cite the source chunks used.
```

### 8. Cited Answer

Every answer should include:

- Short answer
- Reasoning from the retrieved documents
- Citations with source names and chunk ids
- "Not enough evidence" message when retrieval does not support an answer

### 9. Manual Eval Set

Create 10 manual test questions before improving the system.

Each test question should check:

- Did retrieval find the right chunks?
- Did the answer stay faithful to the documents?
- Did the answer avoid medical advice?
- Did the answer cite sources?
- Did the assistant refuse when evidence was missing?

Example eval questions:

1. Can a customer return an opened protein powder after 15 days?
2. Does Magnesium Glycinate contain allergens?
3. Can Nura say its supplement cures anxiety?
4. How long does shipping to Germany take?
5. Can a subscription be cancelled after renewal?
6. What should support do if a customer reports a severe reaction?
7. Can a wholesale customer use the normal refund policy?
8. Is Vitamin D safe for pregnant customers?
9. What discount can support offer without manager approval?
10. What should the assistant say if the answer is not in the docs?

## Non-Goals For Project 01

Do not build these yet:

- Agent workflows
- LangGraph
- CrewAI
- Multi-agent routing
- Hybrid search
- Reranking
- GraphRAG
- Fine-tuning
- Customer account integrations
- Real employer documents
- Real customer data

Project 01 is about understanding the core RAG loop deeply.

## Recommended Tech Stack

Recommended:

- Frontend: Next.js
- Backend/API: Convex functions plus thin Next.js client integration
- Database/vector store: Convex database with Convex vector search
- Embeddings: `text-embedding-3-small` at 1536 dimensions through Microsoft Foundry or Azure OpenAI
- LLM: GPT-4.1 through Microsoft Foundry; GPT-4.1 mini as lower-cost fallback if available
- Styling: Tailwind CSS
- Repo location: `/Users/wasimjalali/Desktop/Personal Project/Nura-Rag`
- Version control: GitHub

Why not use LangChain first:

- For Project 01, build the RAG loop directly so the fundamentals are visible.
- LangChain or LangGraph can be introduced later after Wasim understands each part.

## Suggested App Screens

### 1. Home / Ask Screen

Contains:

- Question input
- Answer area
- Citations
- Retrieved source chunks

### 2. Documents Screen

Contains:

- List of synthetic docs
- Ingestion status
- Source names

### 3. Chunk Preview Screen

Contains:

- Chunk text
- Source document
- Chunk id
- Basic chunk metadata

### 4. Eval Screen

Contains:

- 10 manual questions
- Expected source documents
- Pass/fail notes
- Manual observations

## Success Criteria

The project is successful when:

- A user can ask a policy or product question.
- The app retrieves relevant chunks.
- The answer is grounded in the retrieved chunks.
- Citations are visible.
- The assistant refuses unsupported or medical-risk questions.
- Wasim can explain the full pipeline without reading notes.
- The GitHub README explains the product, architecture, screenshots, and eval results.

## Portfolio Proof

When the project is complete, publish:

- GitHub repository
- README with architecture diagram
- Screenshots or short demo video
- Synthetic docs explanation
- 10-question manual eval table
- Notes on failure modes and improvements

## Where The Project Should Live

Google Drive should hold:

- This project spec
- Learning HTMLs
- Planning notes
- Final portfolio write-up if needed

The codebase should live in the current local workspace.

Local repo location:

```text
/Users/wasimjalali/Desktop/Personal Project/Nura-Rag
```

Recommended GitHub repo name:

```text
nura-rag-copilot
```

Reason:

- Code belongs in Git and GitHub.
- Drive remains the learning and planning system.
- This workspace is the agreed project location for building Nura RAG Copilot.
- No secrets, employer documents, customer data, or confidential files should be stored in the repo.

## Agent Handoff Prompt

Use this prompt when starting the real codebase with a coding agent:

```text
You are helping me build Nura RAG Copilot, Project 01 in my AI Specialist -> Agentic AI Engineer learning path.

Purpose:
This is a learning-by-building project. The goal is to ship a useful supplement e-commerce support RAG assistant while helping me understand the fundamentals deeply: documents, chunking, embeddings, vector store, retriever, grounded RAG prompt, citations, refusals, and manual evals.

Product:
Nura is a realistic customer-support and internal-operations assistant for a synthetic supplement e-commerce company. It answers questions from synthetic company documents, shows citations, and refuses unsupported medical or policy claims.

Important constraints:
- Use only synthetic documents. Do not use employer documents, customer data, confidential files, or Nature Heart IP.
- Keep the codebase in `/Users/wasimjalali/Desktop/Personal Project/Nura-Rag`.
- Do not store secrets in the repo.
- Use Convex for the database, backend functions, and vector search.
- Use `text-embedding-3-small` at 1536 dimensions for embeddings.
- Use GPT-4.1 through Microsoft Foundry as the preferred answer model, with GPT-4.1 mini as the lower-cost fallback if available.
- Build the core RAG loop directly first so the fundamentals are visible. Do not add LangChain, LangGraph, CrewAI, agents, reranking, hybrid search, GraphRAG, or fine-tuning in Project 01 unless I explicitly ask.
- Make retrieval visible in the UI: show source document, chunk id, and retrieved chunk text.
- Every answer must include citations or clearly say the documents do not contain enough evidence.
- The assistant must not provide medical advice or claim that supplements cure, treat, diagnose, or prevent disease.

First task:
Create the project scaffold and add an AGENTS.md file at the repo root before implementation.

AGENTS.md should include:
- Project purpose and learning goal.
- Tech stack and repo structure.
- Model choices: Convex vector search, `text-embedding-3-small` at 1536 dimensions, GPT-4.1 preferred, GPT-4.1 mini fallback.
- RAG rules: synthetic docs only, visible retrieval, citations required, refusal when evidence is missing.
- Safety rules: no medical advice, no real employer data, no secrets.
- Development workflow: implement in small milestones, verify each step, and keep the README updated with architecture, screenshots, and eval results.
- Definition of done for Project 01: synthetic docs loaded, chunks visible, embeddings stored, vector retrieval works, answers are grounded with citations, 10 manual eval questions are included.

After AGENTS.md is created, implement Milestone 1 only: synthetic docs, ingestion, chunk preview, embeddings, vector storage, and one working ask-and-answer flow with citations.
```

## First Build Milestone

Milestone 1 should produce:

- Synthetic docs
- Ingestion script
- Chunk preview
- Embedding creation
- Vector storage
- One working ask-and-answer flow with citations

Do not polish the UI before this flow works.
