# Retrieval Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible retrieval step where a user question is embedded, searched against Convex chunk vectors, and displayed as ranked evidence before answer generation.

**Architecture:** Convex owns provider calls and vector search. Next.js owns the form flow and renders retrieval results from server data. Local pure helpers keep validation, limit clamping, and UI result formatting testable without external services.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Convex actions/queries/vector indexes, Microsoft Foundry OpenAI-compatible embeddings.

## Global Constraints

- Keep the current cream background, white cards, navy accents, and near-black text.
- Use `text-embedding-3-small` embeddings with exactly 1536 dimensions.
- Do not generate final AI answers in this phase.
- Do not add chat history, reranking, hybrid search, user-uploaded documents, auth, or production deployment work.
- Do not read or expose `.env`, `.env.*`, `.env.local`, `.env.convex`, or API keys.
- Real provider calls happen server-side through Convex only.

---

## File Structure

- Modify `convex/schema.ts`: change the embedding validator to `v.array(v.float64())` and add the `by_embedding` vector index.
- Create `convex/embeddingProvider.ts`: shared Foundry embedding config and request helper used by ingestion and retrieval.
- Modify `convex/ragEmbedding.ts`: use the shared embedding provider helper.
- Create `convex/ragRetrieval.ts`: public retrieval action plus internal chunk lookup query.
- Create `src/lib/rag/retrieval.ts`: local pure helpers and shared UI types.
- Create `src/lib/rag/retrieval.test.ts`: TDD coverage for validation, limit clamping, score mapping, and missing-record skipping.
- Modify `src/app/actions.ts`: add the retrieval form server action.
- Modify `src/app/page.tsx`: read `searchParams`, call retrieval when a question is present, and pass state to the dashboard.
- Modify `src/components/rag-visibility-dashboard.tsx`: add a premium retrieval panel and ranked evidence results.
- Modify `src/components/rag-visibility-dashboard.test.tsx`: cover the retrieval empty state, setup state, and rendered results.
- Create `docs/learning/05-retrieval-visibility.md`: explain the retrieval step.
- Modify `README.md`: update the current phase and pipeline checklist.

## Task 1: Retrieval Helper Tests And Implementation

**Files:**
- Create: `src/lib/rag/retrieval.test.ts`
- Create: `src/lib/rag/retrieval.ts`

**Interfaces:**
- Produces: `validateRetrievalQuestion(question: string): string`
- Produces: `clampRetrievalLimit(limit?: number): number`
- Produces: `buildRetrievalResults(matches, chunksById): RetrievalResult[]`
- Produces: `formatRetrievalScore(score: number): string`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from "vitest";

import {
  buildRetrievalResults,
  clampRetrievalLimit,
  formatRetrievalScore,
  validateRetrievalQuestion,
} from "./retrieval";

describe("retrieval helpers", () => {
  it("normalizes a non-empty question and rejects blank questions", () => {
    expect(validateRetrievalQuestion("  What is the return window?  ")).toBe(
      "What is the return window?",
    );
    expect(() => validateRetrievalQuestion("   ")).toThrow(
      "Enter a question to retrieve evidence.",
    );
  });

  it("clamps retrieval result limits to a small predictable range", () => {
    expect(clampRetrievalLimit()).toBe(5);
    expect(clampRetrievalLimit(0)).toBe(1);
    expect(clampRetrievalLimit(7.8)).toBe(7);
    expect(clampRetrievalLimit(40)).toBe(10);
  });

  it("maps vector search scores and chunk records into ranked results", () => {
    const results = buildRetrievalResults(
      [
        { id: "chunk-a", score: 0.81234 },
        { id: "missing", score: 0.7 },
        { id: "chunk-b", score: 0.51234 },
      ],
      new Map([
        [
          "chunk-a",
          {
            chunkId: "chunk-a",
            source: "returns.md",
            section: "Opened Items",
            text: "Opened products can be returned in the policy window.",
            tokenEstimate: 12,
          },
        ],
        [
          "chunk-b",
          {
            chunkId: "chunk-b",
            source: "shipping.md",
            section: "Delays",
            text: "Shipping delays are handled by the support team.",
            tokenEstimate: 10,
          },
        ],
      ]),
    );

    expect(results).toEqual([
      {
        rank: 1,
        score: 0.81234,
        chunkId: "chunk-a",
        source: "returns.md",
        section: "Opened Items",
        text: "Opened products can be returned in the policy window.",
        tokenEstimate: 12,
      },
      {
        rank: 2,
        score: 0.51234,
        chunkId: "chunk-b",
        source: "shipping.md",
        section: "Delays",
        text: "Shipping delays are handled by the support team.",
        tokenEstimate: 10,
      },
    ]);
  });

  it("formats retrieval scores for compact UI display", () => {
    expect(formatRetrievalScore(0.81234)).toBe("0.812");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/rag/retrieval.test.ts`

Expected: FAIL because `src/lib/rag/retrieval.ts` does not exist yet.

- [ ] **Step 3: Implement the helper module**

Create the exported types and functions in `src/lib/rag/retrieval.ts`. Normalize whitespace by trimming only. Clamp limits to the integer range 1 through 10. Default to 5.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/rag/retrieval.test.ts`

Expected: PASS.

## Task 2: Convex Vector Index And Retrieval Action

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/embeddingProvider.ts`
- Modify: `convex/ragEmbedding.ts`
- Create: `convex/ragRetrieval.ts`

**Interfaces:**
- Consumes: stored chunk embeddings from `documentChunks.embedding`
- Produces: `api.ragRetrieval.retrieveRelevantChunks`

- [ ] **Step 1: Update schema for vector search**

Change `embedding` to `v.optional(v.array(v.float64()))` and add:

```ts
.vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,
})
```

- [ ] **Step 2: Extract shared embedding provider helper**

Create `convex/embeddingProvider.ts` with:

```ts
export const EMBEDDING_DIMENSIONS = 1536;
export type EmbeddingConfig = { endpoint: string; apiKey: string; deployment: string };
export function readEmbeddingConfig(): EmbeddingConfig;
export async function requestEmbeddings(config: EmbeddingConfig, input: string[]): Promise<number[][]>;
export function toSafeErrorMessage(error: unknown): string;
```

- [ ] **Step 3: Refactor existing ingestion action**

Update `convex/ragEmbedding.ts` to import `EMBEDDING_DIMENSIONS`, `readEmbeddingConfig`, `requestEmbeddings`, and `toSafeErrorMessage` from `./embeddingProvider`.

- [ ] **Step 4: Implement retrieval action**

Create `convex/ragRetrieval.ts` with:

- Public action `retrieveRelevantChunks({ question, limit })`.
- Internal query `getChunksByIds({ ids })`.
- Question validation using a trimmed string.
- Provider call with one question input.
- Vector dimension validation against 1536.
- `ctx.vectorSearch("documentChunks", "by_embedding", { vector, limit })`.
- Stable result mapping that skips missing records.

- [ ] **Step 5: Push Convex schema/functions once**

Run: `npx convex dev --once`

Expected: Convex accepts the schema, generates APIs, and enables the vector index.

## Task 3: Next.js Retrieval Flow And Premium UI

**Files:**
- Modify: `src/app/actions.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/rag-visibility-dashboard.test.tsx`
- Modify: `src/components/rag-visibility-dashboard.tsx`

**Interfaces:**
- Consumes: `api.ragRetrieval.retrieveRelevantChunks`
- Produces: question form and ranked evidence UI

- [ ] **Step 1: Write failing dashboard UI tests**

Extend `src/components/rag-visibility-dashboard.test.tsx` with assertions that:

- The retrieval panel heading is visible.
- The setup state appears when `embeddedChunks` is 0.
- A ranked result displays score, source, section, and text.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/rag-visibility-dashboard.test.tsx`

Expected: FAIL because retrieval props and UI do not exist yet.

- [ ] **Step 3: Add the retrieval server action**

Add `retrieveSyntheticChunksAction(formData: FormData)` in `src/app/actions.ts`. It reads the `question` field, redirects empty submissions to `/?retrievalError=empty`, and redirects valid submissions to `/?question=<encoded question>`.

- [ ] **Step 4: Add page-level retrieval loading**

Update `src/app/page.tsx` to await `searchParams`, call `fetchAction(api.ragRetrieval.retrieveRelevantChunks, { question, limit: 5 })` when a question is present and embeddings exist, and pass either results or a safe error string to the dashboard.

- [ ] **Step 5: Add premium retrieval UI**

Add a white retrieval panel with:

- Question input.
- Navy primary retrieve button.
- Clear setup/empty/error/result states.
- Ranked evidence cards using score, source, section, chunk ID, and text.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/components/rag-visibility-dashboard.test.tsx`

Expected: PASS.

## Task 4: Learning Docs, Full Verification, And Commit

**Files:**
- Create: `docs/learning/05-retrieval-visibility.md`
- Modify: `README.md`

**Interfaces:**
- Produces: learning explanation for the retrieval phase.

- [ ] **Step 1: Write learning note**

Create `docs/learning/05-retrieval-visibility.md` explaining question embeddings, 1536-dimensional vector compatibility, Convex vector search, similarity scores, and why retrieved chunks are evidence rather than final answers.

- [ ] **Step 2: Update README**

Change the current phase to retrieval visibility and add the new retrieval pieces to the feature list.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 4: Verify real retrieval manually**

Run:

```bash
npx convex run ragRetrieval:retrieveRelevantChunks '{"question":"Can a customer return an opened product?","limit":5}'
```

Expected: returns ranked chunks with scores and source metadata.

- [ ] **Step 5: Commit**

```bash
git add convex src docs README.md
git commit -m "feat: add retrieval visibility"
```
