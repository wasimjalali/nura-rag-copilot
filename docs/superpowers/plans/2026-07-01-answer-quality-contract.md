# Answer Quality Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace loose grounded answer text with a validated paragraph-level answer contract.

**Architecture:** Convex remains the AI boundary. The existing retrieval action returns cited chunks, the grounded-answer helpers build a strict JSON prompt, the answer action parses and validates the model output, and the dashboard renders paragraphs with citations attached to each paragraph.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Convex actions, Microsoft Foundry `gpt-5.4-mini`.

## Global Constraints

- Use synthetic documents only.
- Do not read or expose `.env`, `.env.*`, `.env.local`, `.env.convex`, or API keys.
- Keep retrieved evidence visible in the UI.
- Every grounded paragraph must cite retrieved chunks.
- Unsupported or malformed model output must fall back to insufficient evidence.
- Do not add full chat UI, sidebar navigation, evidence drawer, streaming, conversation history, manual eval dataset, or premium UI research in this phase.

---

## File Structure

- Modify `convex/groundedAnswer.ts`: add structured answer types, JSON prompt instructions, parser, validator, and fallback builder.
- Modify `convex/groundedAnswer.test.ts`: cover prompt shape, valid JSON parsing, invalid JSON fallback, unsupported citations, missing citations, and no-evidence fallback.
- Modify `convex/ragAnswer.ts`: return the structured answer contract from the public action.
- Modify `src/lib/rag/grounded-answer.ts`: mirror the UI-facing structured answer response types.
- Modify `src/components/rag-visibility-dashboard.tsx`: render paragraph-level citations.
- Modify `src/components/rag-visibility-dashboard.test.tsx`: cover paragraph-level citation rendering and insufficient-evidence rendering.
- Create `docs/learning/07-answer-quality-contract.md`: explain structured answers, citation validation, and fallback behavior.
- Modify `README.md`: update current phase and pipeline bullets.

## Task 1: Structured Answer Helpers

**Files:**
- Modify: `convex/groundedAnswer.test.ts`
- Modify: `convex/groundedAnswer.ts`

**Interfaces:**
- Produces: `type GroundedAnswerParagraph = { text: string; citations: string[] }`
- Produces: `type StructuredGroundedAnswer = { answerType: "grounded" | "insufficient_evidence"; paragraphs: GroundedAnswerParagraph[] }`
- Produces: `buildInsufficientEvidenceAnswer(): StructuredGroundedAnswer`
- Produces: `parseStructuredGroundedAnswer(rawContent: string, evidence: CitedRetrievalResult[]): StructuredGroundedAnswer`
- Produces: `structuredAnswerToText(answer: StructuredGroundedAnswer): string`

- [ ] **Step 1: Write failing tests for structured parsing**

Add tests in `convex/groundedAnswer.test.ts`:

```ts
it("parses valid structured grounded JSON", () => {
  const parsed = parseStructuredGroundedAnswer(
    JSON.stringify({
      answerType: "grounded",
      paragraphs: [
        {
          text: "Opened products may be returned within 30 days.",
          citations: ["[1]"],
        },
      ],
    }),
    [
      {
        rank: 1,
        score: 0.7,
        chunkId: "return_policy__chunk_002",
        source: "return_policy.md",
        section: "Standard Return Window",
        text: "Opened products may be returned within 30 days.",
        tokenEstimate: 12,
        citationLabel: "[1]",
      },
    ],
  );

  expect(parsed).toEqual({
    answerType: "grounded",
    paragraphs: [
      {
        text: "Opened products may be returned within 30 days.",
        citations: ["[1]"],
      },
    ],
  });
});

it("falls back when JSON is invalid", () => {
  const parsed = parseStructuredGroundedAnswer("not json", []);

  expect(parsed).toEqual(buildInsufficientEvidenceAnswer());
});

it("falls back when grounded paragraphs omit citations", () => {
  const parsed = parseStructuredGroundedAnswer(
    JSON.stringify({
      answerType: "grounded",
      paragraphs: [{ text: "Opened products may be returned.", citations: [] }],
    }),
    [],
  );

  expect(parsed).toEqual(buildInsufficientEvidenceAnswer());
});

it("falls back when citations were not retrieved", () => {
  const parsed = parseStructuredGroundedAnswer(
    JSON.stringify({
      answerType: "grounded",
      paragraphs: [
        { text: "Opened products may be returned.", citations: ["[9]"] },
      ],
    }),
    [],
  );

  expect(parsed).toEqual(buildInsufficientEvidenceAnswer());
});
```

- [ ] **Step 2: Run helper tests to verify RED**

Run:

```bash
npm test -- convex/groundedAnswer.test.ts
```

Expected: FAIL because the new structured helper exports do not exist.

- [ ] **Step 3: Implement structured helpers**

Add the structured types and functions in `convex/groundedAnswer.ts`. `parseStructuredGroundedAnswer` should parse JSON, trim paragraph text, remove duplicate citations, reject non-array paragraphs, reject empty grounded paragraphs, reject citations not in evidence, and return `buildInsufficientEvidenceAnswer()` for invalid output.

- [ ] **Step 4: Update prompt test and prompt implementation**

Update the existing prompt test to assert that the system/user messages require JSON with `answerType`, `paragraphs`, `text`, and `citations`. Update `buildGroundedAnswerMessages` to include those exact contract terms.

- [ ] **Step 5: Run helper tests to verify GREEN**

Run:

```bash
npm test -- convex/groundedAnswer.test.ts
```

Expected: PASS.

## Task 2: Convex Action Structured Response

**Files:**
- Modify: `convex/ragAnswer.ts`

**Interfaces:**
- Consumes: `parseStructuredGroundedAnswer(rawContent, citedResults)`
- Consumes: `buildInsufficientEvidenceAnswer()`
- Produces: `generateGroundedAnswer` response with `structuredAnswer` and legacy `answer`

- [ ] **Step 1: Update Convex return validator**

Add nested validators for:

```ts
structuredAnswer: {
  answerType: "grounded" | "insufficient_evidence";
  paragraphs: Array<{ text: string; citations: string[] }>;
}
```

- [ ] **Step 2: Parse the model response**

Change the provider call flow to:

```ts
const rawAnswer = await requestChatCompletion(config, messages);
const structuredAnswer = parseStructuredGroundedAnswer(rawAnswer, citedResults);
const answer = structuredAnswerToText(structuredAnswer);
```

For no evidence, return `buildInsufficientEvidenceAnswer()` and its text version.

- [ ] **Step 3: Deploy Convex functions**

Run:

```bash
npx convex dev --once
```

Expected: Convex accepts the updated action return type.

## Task 3: Dashboard Paragraph Citations

**Files:**
- Modify: `src/lib/rag/grounded-answer.ts`
- Modify: `src/components/rag-visibility-dashboard.test.tsx`
- Modify: `src/components/rag-visibility-dashboard.tsx`

**Interfaces:**
- Consumes: `GroundedAnswerResponse.structuredAnswer.paragraphs`
- Produces: visible paragraph-level citation chips in the answer panel

- [ ] **Step 1: Update UI types**

Add:

```ts
export type GroundedAnswerParagraph = {
  text: string;
  citations: string[];
};

export type StructuredGroundedAnswer = {
  answerType: "grounded" | "insufficient_evidence";
  paragraphs: GroundedAnswerParagraph[];
};
```

Then add `structuredAnswer: StructuredGroundedAnswer` to `GroundedAnswerResponse`.

- [ ] **Step 2: Write failing dashboard tests**

Update the grounded answer fixture so `groundedAnswer.structuredAnswer.paragraphs` contains two paragraphs with different citations. Assert that each paragraph text appears and that citation labels appear near the answer panel.

- [ ] **Step 3: Run dashboard tests to verify RED**

Run:

```bash
npm test -- src/components/rag-visibility-dashboard.test.tsx
```

Expected: FAIL until the component renders `structuredAnswer.paragraphs`.

- [ ] **Step 4: Render structured paragraphs**

Replace the single answer paragraph in the answer panel with a mapped list of paragraphs. Each paragraph should render text followed by its citation chips. If `structuredAnswer.answerType` is `insufficient_evidence`, show the same paragraph UI but avoid showing citation chips when the citations array is empty.

- [ ] **Step 5: Run dashboard tests to verify GREEN**

Run:

```bash
npm test -- src/components/rag-visibility-dashboard.test.tsx
```

Expected: PASS.

## Task 4: Learning Docs, Real Answer, And Final Verification

**Files:**
- Create: `docs/learning/07-answer-quality-contract.md`
- Modify: `README.md`

**Interfaces:**
- Produces: learning material and updated project phase.

- [ ] **Step 1: Add learning note**

Explain:

- Why plain text answers are hard to validate.
- Why structured output helps.
- Why each paragraph gets its own citations.
- Why invalid model output falls back to insufficient evidence.

- [ ] **Step 2: Update README**

Set current phase to answer quality contract and add bullets for structured paragraphs, citation validation, and safe fallback.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
npx convex run ragAnswer:generateGroundedAnswer '{"question":"Can a customer return an opened product?","limit":5}'
```

Expected: tests/lint/build pass; Convex returns `structuredAnswer` with cited paragraphs.

- [ ] **Step 4: Browser smoke check**

Open:

```text
http://localhost:3000/?question=Can%20a%20customer%20return%20an%20opened%20product%3F
```

Verify paragraph text, citation chips, cited evidence, desktop layout, and mobile layout.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add README.md convex src docs/learning/07-answer-quality-contract.md
git commit -m "feat: add answer quality contract"
```
