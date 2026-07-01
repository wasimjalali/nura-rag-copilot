# Embedding Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add embedding configuration, vector dimension validation, and learning UI for the transition from chunk preview to embeddings.

**Architecture:** Keep API-free embedding decisions in small reusable TypeScript modules under `src/lib/rag/`. Pass the embedding config into the existing RAG visibility dashboard so the user sees which model and vector size the next phase will use.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- Use only synthetic documents. Do not use employer documents, customer data, confidential files, or Nature Heart IP.
- Keep the codebase in `/Users/wasimjalali/Desktop/Personal Project/Nura-Rag`.
- Do not store secrets in the repo.
- This phase must not call Microsoft Foundry, OpenAI, Convex mutations, or Convex vector search.
- Use `text-embedding-3-small` at 1536 dimensions for embeddings in later phases.
- Use GPT-4.1 through Microsoft Foundry as the preferred answer model, with GPT-4.1 mini as the lower-cost fallback if available.

---

## File Structure

- Create: `src/lib/rag/embedding-config.ts` for central embedding settings.
- Create: `src/lib/rag/vector-validation.ts` for dimension validation.
- Create: `src/lib/rag/embedding-readiness.test.ts` for tests.
- Modify: `src/components/rag-visibility-dashboard.tsx` to show embedding readiness.
- Modify: `src/components/rag-visibility-dashboard.test.tsx` to assert the readiness UI.
- Modify: `src/app/page.tsx` to pass embedding config.
- Create: `docs/learning/03-embedding-readiness.md`.
- Modify: `README.md`.

---

### Task 1: Add Embedding Config and Validation

**Files:**
- Create: `src/lib/rag/embedding-config.ts`
- Create: `src/lib/rag/vector-validation.ts`
- Create: `src/lib/rag/embedding-readiness.test.ts`

**Interfaces:**
- Produces: `embeddingConfig`, `validateEmbeddingDimensions`, and `isEmbeddingReady`.

- [ ] **Step 1: Write failing tests**

Create `src/lib/rag/embedding-readiness.test.ts` with tests for model name, dimensions, valid vector length, invalid vector length, and missing deployment name.

- [ ] **Step 2: Run tests and verify failure**

Run `npm test -- src/lib/rag/embedding-readiness.test.ts`.

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement config and validation**

Create the modules with no API calls and no secrets.

- [ ] **Step 4: Run tests and verify pass**

Run `npm test -- src/lib/rag/embedding-readiness.test.ts`.

Expected: PASS.

---

### Task 2: Add Embedding Readiness UI

**Files:**
- Modify: `src/components/rag-visibility-dashboard.tsx`
- Modify: `src/components/rag-visibility-dashboard.test.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `embeddingConfig`.
- Produces: visible model/dimension readiness summary.

- [ ] **Step 1: Update UI test first**

Assert that the dashboard shows `text-embedding-3-small`, `1536 dimensions`, and `Human review comes before embedding`.

- [ ] **Step 2: Run UI test and verify failure**

Run `npm test -- src/components/rag-visibility-dashboard.test.tsx`.

Expected: FAIL until UI is updated.

- [ ] **Step 3: Update dashboard**

Add a white card that explains the reviewed chunks will become embeddings next.

- [ ] **Step 4: Run UI test and verify pass**

Run `npm test -- src/components/rag-visibility-dashboard.test.tsx`.

Expected: PASS.

---

### Task 3: Add Learning Note and Verify

**Files:**
- Create: `docs/learning/03-embedding-readiness.md`
- Modify: `README.md`

**Interfaces:**
- Produces: learning summary and current phase update.

- [ ] **Step 1: Add learning note**

Explain previous steps, current step, next step, automatic chunking, human review, and vector dimensions.

- [ ] **Step 2: Update README**

Add embedding readiness to the current phase list.

- [ ] **Step 3: Verify**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add .
git commit -m "feat: add embedding readiness"
```
