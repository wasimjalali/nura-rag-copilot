# RAG Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add synthetic documents, deterministic chunking, and a visible chunk preview UI without embeddings or model calls.

**Architecture:** Markdown files under `content/synthetic-docs/` form the local knowledge base. Server-side TypeScript utilities in `src/lib/rag/` load documents and chunk them by headings and size. The home page renders a compact dashboard that shows documents and chunks so the next phase can embed visible, inspectable units.

**Tech Stack:** Next.js App Router, TypeScript, Node filesystem APIs, Vitest, Testing Library, Tailwind CSS.

## Global Constraints

- Use only synthetic documents. Do not use employer documents, customer data, confidential files, or Nature Heart IP.
- Keep the codebase in `/Users/wasimjalali/Desktop/Personal Project/Nura-Rag`.
- Do not store secrets in the repo.
- Use Convex for the database, backend functions, and vector search in later phases.
- Use `text-embedding-3-small` at 1536 dimensions for embeddings in later phases.
- Use GPT-4.1 through Microsoft Foundry as the preferred answer model, with GPT-4.1 mini as the lower-cost fallback if available.
- This phase must not call Microsoft Foundry, OpenAI, Convex mutations, or Convex vector search.
- Make documents and chunks visible in the UI.
- Keep chunk ids stable with the format `<source-without-extension>__chunk_<three-digit-number>`.
- The assistant must not provide medical advice or claim that supplements cure, treat, diagnose, or prevent disease.

---

## File Structure

- Create: `content/synthetic-docs/*.md` for ten synthetic company documents.
- Create: `src/lib/rag/types.ts` for document and chunk types.
- Create: `src/lib/rag/chunk.ts` for heading parsing and chunking.
- Create: `src/lib/rag/load-documents.ts` for filesystem document loading.
- Create: `src/lib/rag/rag-preview.test.ts` for loader and chunker tests.
- Create: `src/components/rag-visibility-dashboard.tsx` for the document and chunk UI.
- Create: `src/components/rag-visibility-dashboard.test.tsx` for UI smoke tests.
- Modify: `src/app/page.tsx` to load documents/chunks and render the dashboard.
- Create: `docs/learning/02-rag-visibility.md` for the learning checkpoint.
- Modify: `README.md` with the current phase.

---

### Task 1: Add Synthetic Documents

**Files:**
- Create: `content/synthetic-docs/return_policy.md`
- Create: `content/synthetic-docs/shipping_policy.md`
- Create: `content/synthetic-docs/subscription_policy.md`
- Create: `content/synthetic-docs/product_catalog.md`
- Create: `content/synthetic-docs/ingredient_glossary.md`
- Create: `content/synthetic-docs/allergen_policy.md`
- Create: `content/synthetic-docs/supplement_usage_faq.md`
- Create: `content/synthetic-docs/health_claims_compliance.md`
- Create: `content/synthetic-docs/support_escalation_sop.md`
- Create: `content/synthetic-docs/discount_refund_approval_rules.md`

**Interfaces:**
- Consumes: project safety constraints.
- Produces: ten fictional markdown files loaded by later tasks.

- [ ] **Step 1: Create synthetic docs**

Each document must:

- Use a single `#` title.
- Use multiple `##` sections.
- Contain fictional company policy or product information only.
- Include no real employer, customer, or confidential data.
- Include enough paragraphs to produce multiple chunks across the corpus.

- [ ] **Step 2: Verify file list**

Run:

```bash
find content/synthetic-docs -maxdepth 1 -name '*.md' | sort
```

Expected: exactly ten markdown files with the names listed above.

---

### Task 2: Build Loader and Chunker Test First

**Files:**
- Create: `src/lib/rag/rag-preview.test.ts`
- Create later: `src/lib/rag/types.ts`
- Create later: `src/lib/rag/chunk.ts`
- Create later: `src/lib/rag/load-documents.ts`

**Interfaces:**
- Consumes: markdown documents from Task 1.
- Produces: failing tests that define the loader and chunker behavior.

- [ ] **Step 1: Write failing tests**

Create `src/lib/rag/rag-preview.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { chunkDocuments, estimateTokenCount } from "./chunk";
import { loadSyntheticDocuments } from "./load-documents";

describe("RAG preview document loading and chunking", () => {
  it("loads the ten synthetic source documents", async () => {
    const documents = await loadSyntheticDocuments();

    expect(documents).toHaveLength(10);
    expect(documents.map((doc) => doc.source).sort()).toEqual([
      "allergen_policy.md",
      "discount_refund_approval_rules.md",
      "health_claims_compliance.md",
      "ingredient_glossary.md",
      "product_catalog.md",
      "return_policy.md",
      "shipping_policy.md",
      "subscription_policy.md",
      "supplement_usage_faq.md",
      "support_escalation_sop.md",
    ]);
    expect(documents[0]).toEqual(
      expect.objectContaining({
        source: expect.stringMatching(/\\.md$/),
        title: expect.any(String),
        text: expect.stringContaining("##"),
      }),
    );
  });

  it("creates stable heading-aware chunks", async () => {
    const chunks = chunkDocuments(await loadSyntheticDocuments());

    expect(chunks.length).toBeGreaterThan(20);
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        id: "allergen_policy__chunk_001",
        source: "allergen_policy.md",
        section: expect.any(String),
        text: expect.any(String),
        tokenEstimate: expect.any(Number),
        createdAt: "2026-07-01T00:00:00.000Z",
      }),
    );
    expect(chunks.every((chunk) => chunk.text.trim().length > 0)).toBe(true);
    expect(chunks.every((chunk) => chunk.tokenEstimate > 0)).toBe(true);
    expect(chunks.some((chunk) => chunk.section === "Customer-Facing Guidance")).toBe(true);
  });

  it("estimates token count from words", () => {
    expect(estimateTokenCount("alpha beta gamma delta")).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/rag/rag-preview.test.ts
```

Expected: FAIL because `./chunk` and `./load-documents` do not exist.

---

### Task 3: Implement Loader and Chunker

**Files:**
- Create: `src/lib/rag/types.ts`
- Create: `src/lib/rag/chunk.ts`
- Create: `src/lib/rag/load-documents.ts`

**Interfaces:**
- Consumes: `KnowledgeDocument[]`.
- Produces: `DocumentChunk[]`.

- [ ] **Step 1: Add types**

Create `src/lib/rag/types.ts`:

```ts
export type KnowledgeDocument = {
  source: string;
  title: string;
  text: string;
};

export type DocumentChunk = {
  id: string;
  source: string;
  section: string;
  text: string;
  tokenEstimate: number;
  createdAt: string;
};
```

- [ ] **Step 2: Implement chunking**

Create `src/lib/rag/chunk.ts` with exported functions:

```ts
import type { DocumentChunk, KnowledgeDocument } from "./types";

const PREVIEW_CREATED_AT = "2026-07-01T00:00:00.000Z";
const TARGET_WORDS = 160;
const MAX_WORDS = 220;

export function estimateTokenCount(text: string) {
  const wordCount = text.trim().split(/\\s+/).filter(Boolean).length;
  return Math.ceil(wordCount * 1.35);
}

export function chunkDocuments(documents: KnowledgeDocument[]): DocumentChunk[] {
  return documents.flatMap((document) => chunkDocument(document));
}

function chunkDocument(document: KnowledgeDocument): DocumentChunk[] {
  const sections = splitBySecondLevelHeading(document.text);
  let chunkNumber = 1;

  return sections.flatMap((section) => {
    const pieces = splitSectionText(section.body);

    return pieces.map((piece) => ({
      id: `${sourceSlug(document.source)}__chunk_${String(chunkNumber++).padStart(3, "0")}`,
      source: document.source,
      section: section.heading,
      text: piece,
      tokenEstimate: estimateTokenCount(piece),
      createdAt: PREVIEW_CREATED_AT,
    }));
  });
}

function splitBySecondLevelHeading(markdown: string) {
  const lines = markdown.split(/\\r?\\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = "Overview";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      pushSection();
      currentHeading = line.replace(/^##\\s+/, "").trim();
      currentLines = [];
    } else if (!line.startsWith("# ")) {
      currentLines.push(line);
    }
  }

  pushSection();
  return sections.filter((section) => section.body.length > 0);

  function pushSection() {
    const body = currentLines.join("\\n").trim();
    if (body.length > 0) {
      sections.push({ heading: currentHeading, body });
    }
  }
}

function splitSectionText(text: string) {
  const paragraphs = text
    .split(/\\n\\s*\\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current: string[] = [];

  for (const paragraph of paragraphs) {
    if (wordCount(paragraph) > MAX_WORDS) {
      flush();
      chunks.push(...splitLongParagraph(paragraph));
      continue;
    }

    const proposed = [...current, paragraph].join("\\n\\n");
    if (current.length > 0 && wordCount(proposed) > TARGET_WORDS) {
      flush();
    }
    current.push(paragraph);
  }

  flush();
  return chunks;

  function flush() {
    if (current.length > 0) {
      chunks.push(current.join("\\n\\n"));
      current = [];
    }
  }
}

function splitLongParagraph(paragraph: string) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [paragraph];
  const chunks: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences.map((item) => item.trim()).filter(Boolean)) {
    const proposed = [...current, sentence].join(" ");
    if (current.length > 0 && wordCount(proposed) > TARGET_WORDS) {
      chunks.push(current.join(" "));
      current = [];
    }
    current.push(sentence);
  }

  if (current.length > 0) {
    chunks.push(current.join(" "));
  }

  return chunks;
}

function sourceSlug(source: string) {
  return source.replace(/\\.md$/, "").replace(/[^a-z0-9]+/g, "_");
}

function wordCount(text: string) {
  return text.trim().split(/\\s+/).filter(Boolean).length;
}
```

- [ ] **Step 3: Implement document loader**

Create `src/lib/rag/load-documents.ts`:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";

import type { KnowledgeDocument } from "./types";

const SYNTHETIC_DOCS_DIR = path.join(process.cwd(), "content", "synthetic-docs");

export async function loadSyntheticDocuments(): Promise<KnowledgeDocument[]> {
  let fileNames: string[];

  try {
    fileNames = await fs.readdir(SYNTHETIC_DOCS_DIR);
  } catch {
    return [];
  }

  const markdownFiles = fileNames.filter((fileName) => fileName.endsWith(".md")).sort();

  return Promise.all(
    markdownFiles.map(async (source) => {
      const filePath = path.join(SYNTHETIC_DOCS_DIR, source);
      const text = await fs.readFile(filePath, "utf8");

      return {
        source,
        title: extractTitle(text, source),
        text,
      };
    }),
  );
}

function extractTitle(markdown: string, fallback: string) {
  const title = markdown
    .split(/\\r?\\n/)
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\\s+/, "")
    .trim();

  return title || fallback.replace(/\\.md$/, "").replace(/_/g, " ");
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- src/lib/rag/rag-preview.test.ts
```

Expected: PASS.

---

### Task 4: Add RAG Visibility UI Test First

**Files:**
- Create: `src/components/rag-visibility-dashboard.test.tsx`
- Create later: `src/components/rag-visibility-dashboard.tsx`
- Modify later: `src/app/page.tsx`

**Interfaces:**
- Consumes: `KnowledgeDocument[]` and `DocumentChunk[]`.
- Produces: failing UI test for dashboard display.

- [ ] **Step 1: Write failing UI test**

Create `src/components/rag-visibility-dashboard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RagVisibilityDashboard } from "./rag-visibility-dashboard";

const documents = [
  {
    source: "return_policy.md",
    title: "Return Policy",
    text: "# Return Policy\\n\\n## Opened Products\\nCustomers can return opened products.",
  },
];

const chunks = [
  {
    id: "return_policy__chunk_001",
    source: "return_policy.md",
    section: "Opened Products",
    text: "Customers can return opened products within the policy window.",
    tokenEstimate: 11,
    createdAt: "2026-07-01T00:00:00.000Z",
  },
];

describe("RagVisibilityDashboard", () => {
  it("shows documents and chunk preview details", () => {
    render(<RagVisibilityDashboard documents={documents} chunks={chunks} />);

    expect(screen.getByRole("heading", { name: "RAG visibility" })).toBeInTheDocument();
    expect(screen.getByText("return_policy.md")).toBeInTheDocument();
    expect(screen.getByText("return_policy__chunk_001")).toBeInTheDocument();
    expect(screen.getByText("Opened Products")).toBeInTheDocument();
    expect(screen.getByText(/This is what will be embedded next/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/components/rag-visibility-dashboard.test.tsx
```

Expected: FAIL because the component does not exist.

---

### Task 5: Implement RAG Visibility UI

**Files:**
- Create: `src/components/rag-visibility-dashboard.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `KnowledgeDocument[]` and `DocumentChunk[]`.
- Produces: visible document and chunk dashboard.

- [ ] **Step 1: Implement dashboard component**

Create `src/components/rag-visibility-dashboard.tsx` with props:

```ts
type RagVisibilityDashboardProps = {
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
};
```

The component must show:

- Heading text `RAG visibility`.
- Summary counts for documents and chunks.
- A document list with source, title, section count, and word count.
- A chunk preview list with id, source, section, token estimate, and text.
- The text `This is what will be embedded next`.

- [ ] **Step 2: Wire home page**

Replace `src/app/page.tsx` with a Server Component that loads documents, chunks them, and renders `RagVisibilityDashboard`.

- [ ] **Step 3: Run UI test**

Run:

```bash
npm test -- src/components/rag-visibility-dashboard.test.tsx
```

Expected: PASS.

---

### Task 6: Add Learning Note and README Update

**Files:**
- Create: `docs/learning/02-rag-visibility.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: completed RAG visibility phase.
- Produces: human-readable learning checkpoint.

- [ ] **Step 1: Add learning note**

Create `docs/learning/02-rag-visibility.md` explaining:

- Documents are the raw knowledge base.
- Chunks are the smaller units that will be embedded.
- Metadata keeps answers auditable.
- Chunk size affects retrieval.
- Embeddings are intentionally deferred to the next phase.

- [ ] **Step 2: Update README current phase**

Update `README.md` so the current phase includes:

- Synthetic docs.
- Document loader.
- Chunk preview.
- Tests for loading and chunking.

---

### Task 7: Verify and Commit

**Files:**
- Verify all created and modified files.

**Interfaces:**
- Consumes: completed Step 2 files.
- Produces: committed RAG visibility checkpoint.

- [ ] **Step 1: Run tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add .
git commit -m "feat: add rag visibility preview"
```

Expected: Step 2 changes are committed.
