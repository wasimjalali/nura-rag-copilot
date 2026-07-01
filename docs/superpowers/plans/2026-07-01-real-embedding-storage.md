# Real Embedding Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store reviewed synthetic chunks in Convex, generate real Microsoft Foundry embeddings, and show storage/embedding status in the UI.

**Architecture:** Next.js continues to load and chunk synthetic markdown for preview. A server action sends those reviewed documents and chunks to a Convex action. The Convex action calls the Azure OpenAI-compatible `/openai/v1/embeddings` endpoint, validates 1536-dimensional vectors, and persists them through internal mutations.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Convex, Microsoft Foundry Azure OpenAI v1 embeddings API, Vitest.

## Global Constraints

- Use real embedding API calls in the application workflow; do not add a mock product path.
- Keep secrets out of `.env`, source code, test output, logs, and UI.
- The embedding model is `text-embedding-3-small`.
- The embedding dimension count is `1536`.
- The answer model is `gpt-5.4-mini`, but answer generation is out of scope for this phase.
- Use Convex for storage; do not introduce Supabase or another database.
- Do not add LangChain, LangGraph, agents, reranking, hybrid search, or GraphRAG.
- Use only synthetic documents.
- Preserve the cream, white, navy, and near-black UI palette.

---

## File Structure

- `src/lib/rag/storage-records.ts`: Pure mapping helpers from preview documents/chunks into Convex-safe payloads plus status summarization.
- `src/lib/rag/storage-records.test.ts`: TDD tests for payload mapping and status summaries.
- `convex/schema.ts`: Add `sourceDocuments`, `documentChunks`, and `embeddingRuns` tables.
- `convex/ragStorage.ts`: Convex queries and internal mutations for status, idempotent upsert, run tracking, and embedding persistence.
- `convex/ragEmbedding.ts`: Public Convex action that validates env, calls Foundry embeddings, validates vectors, and saves results.
- `src/app/actions.ts`: Server action that loads synthetic docs/chunks and calls the Convex embedding action.
- `src/app/page.tsx`: Fetch Convex status and pass it into the dashboard; mark the route dynamic.
- `src/components/rag-visibility-dashboard.tsx`: Add storage status panel and form button.
- `src/components/rag-visibility-dashboard.test.tsx`: Assert the new status panel and action form render.
- `docs/learning/04-real-embedding-storage.md`: Learning note for this phase.
- `README.md`: Update current phase summary.

---

### Task 1: Storage Payload Helpers

**Files:**
- Create: `src/lib/rag/storage-records.ts`
- Test: `src/lib/rag/storage-records.test.ts`

**Interfaces:**
- Consumes: `KnowledgeDocument`, `DocumentChunk` from `src/lib/rag/types.ts`.
- Produces:
  - `toSourceDocumentRecords(documents: KnowledgeDocument[]): SourceDocumentRecordInput[]`
  - `toDocumentChunkRecords(chunks: DocumentChunk[]): DocumentChunkRecordInput[]`
  - `summarizeEmbeddingStorageStatus(status: EmbeddingStorageStatus): EmbeddingStorageStatusSummary`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  summarizeEmbeddingStorageStatus,
  toDocumentChunkRecords,
  toSourceDocumentRecords,
} from "./storage-records";

describe("storage record helpers", () => {
  it("maps synthetic documents into stable Convex source records", () => {
    const records = toSourceDocumentRecords([
      {
        source: "return_policy.md",
        title: "Return Policy",
        text: "# Return Policy\n\n## Window\nReturns are available.",
      },
    ]);

    expect(records).toEqual([
      {
        source: "return_policy.md",
        title: "Return Policy",
        textHash:
          "b13e9f0d2ec8c871fddae0de286d4229371b7a2514139522f2b6dfbe37d644e6",
        wordCount: 7,
      },
    ]);
  });

  it("maps visible chunks into Convex chunk records", () => {
    const records = toDocumentChunkRecords([
      {
        id: "return_policy__chunk_001",
        source: "return_policy.md",
        section: "Window",
        text: "Returns are available.",
        tokenEstimate: 5,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ]);

    expect(records).toEqual([
      {
        chunkId: "return_policy__chunk_001",
        source: "return_policy.md",
        section: "Window",
        text: "Returns are available.",
        tokenEstimate: 5,
      },
    ]);
  });

  it("summarizes stored and embedded counts for the dashboard", () => {
    expect(
      summarizeEmbeddingStorageStatus({
        storedDocuments: 10,
        storedChunks: 31,
        embeddedChunks: 30,
        lastRunStatus: "failed",
        lastRunMessage: "1 chunk returned 3 dimensions.",
        lastEmbeddedAt: 1782920000000,
      }),
    ).toEqual({
      storedDocumentsLabel: "10 documents",
      storedChunksLabel: "31 stored",
      embeddedChunksLabel: "30 embedded",
      lastRunLabel: "failed",
      lastRunMessage: "1 chunk returned 3 dimensions.",
      lastEmbeddedAtLabel: "Jul 1, 2026",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/lib/rag/storage-records.test.ts`

Expected: FAIL because `src/lib/rag/storage-records.ts` does not exist.

- [ ] **Step 3: Implement helpers**

Create `src/lib/rag/storage-records.ts` with SHA-256 hashing, record mappers, and label formatting.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/lib/rag/storage-records.test.ts`

Expected: PASS.

---

### Task 2: Convex Storage And Embedding Functions

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/ragStorage.ts`
- Create: `convex/ragEmbedding.ts`

**Interfaces:**
- Consumes: document/chunk payloads produced by Task 1.
- Produces:
  - Public query `api.ragStorage.getStorageStatus`
  - Public action `api.ragEmbedding.embedReviewedChunks`
  - Internal mutations for upsert/run tracking/embedding saves.

- [ ] **Step 1: Update schema**

Add tables for source documents, document chunks, and embedding runs. Keep existing `projectNotes`.

- [ ] **Step 2: Add Convex storage functions**

Implement `getStorageStatus`, `upsertPreviewRecords`, `startEmbeddingRun`, `saveEmbeddings`, `finishEmbeddingRun`, and `failEmbeddingRun`.

- [ ] **Step 3: Add embedding action**

Implement `embedReviewedChunks` so it:

1. Requires `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and `AZURE_OPENAI_EMBEDDING_DEPLOYMENT`.
2. Upserts documents/chunks.
3. Posts to `{endpoint}/embeddings` with `api-key` authentication, `model`, `input`, `dimensions: 1536`, and `encoding_format: "float"`.
4. Parses only `data[].index` and `data[].embedding`.
5. Validates each vector is 1536 dimensions.
6. Saves all embeddings after all vectors pass validation.

- [ ] **Step 4: Push Convex functions**

Run: `npx convex dev --once`

Expected: Convex functions ready, generated files updated.

---

### Task 3: Server Action And Dashboard UI

**Files:**
- Create: `src/app/actions.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/rag-visibility-dashboard.tsx`
- Modify: `src/components/rag-visibility-dashboard.test.tsx`

**Interfaces:**
- Consumes: `api.ragStorage.getStorageStatus`, `api.ragEmbedding.embedReviewedChunks`, and Task 1 payload helpers.
- Produces: a dashboard form that triggers real embedding generation and a status panel showing stored/embedded counts.

- [ ] **Step 1: Write failing UI test**

Add expectations that the dashboard renders:

```ts
expect(screen.getByText("Storage status")).toBeInTheDocument();
expect(screen.getByText("31 stored")).toBeInTheDocument();
expect(screen.getByText("30 embedded")).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Store and embed chunks" })).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/components/rag-visibility-dashboard.test.tsx`

Expected: FAIL because the status panel does not exist.

- [ ] **Step 3: Add server action**

Create `embedSyntheticDocumentsAction` in `src/app/actions.ts`. It loads documents, chunks them, maps records, calls `fetchAction(api.ragEmbedding.embedReviewedChunks, args)`, and calls `revalidatePath("/")`.

- [ ] **Step 4: Wire page data**

In `src/app/page.tsx`, export `dynamic = "force-dynamic"`, fetch Convex storage status with `fetchQuery`, and pass the server action and status into the dashboard.

- [ ] **Step 5: Add dashboard status panel**

Render preview count, stored count, embedded count, last run status, and a submit button.

- [ ] **Step 6: Run UI test to verify it passes**

Run: `npm test src/components/rag-visibility-dashboard.test.tsx`

Expected: PASS.

---

### Task 4: Learning Notes And Verification

**Files:**
- Create: `docs/learning/04-real-embedding-storage.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: implementation behavior from Tasks 1-3.
- Produces: learning documentation and final verified build.

- [ ] **Step 1: Add learning note**

Document the difference between preview chunks, stored chunks, embeddings, Convex actions, and idempotent imports.

- [ ] **Step 2: Update README current phase**

Add Convex storage, real embedding action, and storage status UI to the current phase list.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
npx convex env list --names-only
```

Expected: tests/lint/build pass, and env names include `AZURE_OPENAI_API_KEY`.

- [ ] **Step 4: Verify real embedding action**

Run the real action through the dashboard button or `npx convex run` with the generated chunk payload.

Expected: stored chunk count equals preview chunk count, and embedded chunk count equals stored chunk count.

- [ ] **Step 5: Commit**

Commit message: `feat: store real chunk embeddings`

---
