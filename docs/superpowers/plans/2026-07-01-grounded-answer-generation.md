# Grounded Answer Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a grounded support answer from the retrieved Convex evidence chunks and show the answer plus citations in the dashboard.

**Architecture:** Convex remains the server-side AI boundary. The new answer action calls the existing retrieval action, formats retrieved chunks as citation-labeled evidence, calls the Microsoft Foundry chat deployment, and returns the answer plus evidence to the Next.js page.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Convex actions/vector search, Microsoft Foundry OpenAI-compatible embeddings and chat completions.

## Global Constraints

- Keep the current cream, white, navy, and near-black palette.
- Use `text-embedding-3-small` embeddings with exactly 1536 dimensions.
- Use `AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-5.4-mini` for grounded answers.
- Answer only from retrieved evidence.
- Keep retrieved evidence visible below the answer.
- Do not add streaming, multi-turn chat history, user-uploaded documents, hybrid search, reranking, eval datasets, auth, billing, or deployment.
- Do not read or expose `.env`, `.env.*`, `.env.local`, `.env.convex`, or API keys.

---

## File Structure

- Create `convex/answerProvider.ts`: reads answer model config and calls the OpenAI-compatible chat completions endpoint.
- Create `convex/answerProvider.test.ts`: verifies chat request shape and response parsing.
- Create `convex/groundedAnswer.ts`: pure prompt/citation helpers for grounded generation.
- Create `convex/groundedAnswer.test.ts`: verifies citation labels, evidence formatting, prompt content, and insufficient-evidence answer.
- Create `convex/ragAnswer.ts`: public Convex action that retrieves chunks, builds prompt messages, calls the answer provider, and returns answer plus cited evidence.
- Create `src/lib/rag/grounded-answer.ts`: UI-facing grounded-answer types.
- Modify `src/app/actions.ts`: add answer-generation form action.
- Modify `src/app/page.tsx`: call `api.ragAnswer.generateGroundedAnswer` for submitted questions.
- Modify `src/components/rag-visibility-dashboard.tsx`: evolve retrieval panel into answer workspace.
- Modify `src/components/rag-visibility-dashboard.test.tsx`: cover answer rendering, citation chips, setup state, and error state.
- Create `docs/learning/06-grounded-answer-generation.md`: learning note for answer generation.
- Modify `README.md`: update current phase.

## Task 1: Provider And Prompt Helpers

**Files:**
- Create: `convex/answerProvider.test.ts`
- Create: `convex/answerProvider.ts`
- Create: `convex/groundedAnswer.test.ts`
- Create: `convex/groundedAnswer.ts`

**Interfaces:**
- Produces: `readAnswerConfig(): AnswerConfig`
- Produces: `requestChatCompletion(config, messages): Promise<string>`
- Produces: `buildGroundedAnswerMessages(question, evidence): ChatMessage[]`
- Produces: `addCitationLabels(results): CitedRetrievalResult[]`
- Produces: `INSUFFICIENT_EVIDENCE_ANSWER`

- [ ] **Step 1: Write failing provider tests**

Add tests that stub `fetch`, call `requestChatCompletion`, and verify:

- URL ends with `/chat/completions`.
- Body includes `model`, `messages`, `temperature: 0.2`, and `max_tokens: 500`.
- Returned text is parsed from `choices[0].message.content`.

- [ ] **Step 2: Run provider tests to verify RED**

Run: `npm test -- convex/answerProvider.test.ts`

Expected: FAIL because `convex/answerProvider.ts` does not exist.

- [ ] **Step 3: Implement provider helper**

Implement config reads from `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and `AZURE_OPENAI_CHAT_DEPLOYMENT`. Implement `toChatCompletionsUrl(endpoint)` by trimming trailing slashes and appending `/chat/completions`.

- [ ] **Step 4: Run provider tests to verify GREEN**

Run: `npm test -- convex/answerProvider.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing prompt helper tests**

Add tests that verify:

- Citation labels become `[1]`, `[2]`.
- Prompt evidence includes source, section, chunk ID, score, and text.
- System message forbids inventing facts outside evidence.
- Empty evidence returns `INSUFFICIENT_EVIDENCE_ANSWER`.

- [ ] **Step 6: Run prompt tests to verify RED**

Run: `npm test -- convex/groundedAnswer.test.ts`

Expected: FAIL because `convex/groundedAnswer.ts` does not exist.

- [ ] **Step 7: Implement prompt helper**

Implement citation labeling, score formatting with three decimals, strict system/user messages, and the insufficient-evidence constant.

- [ ] **Step 8: Run prompt tests to verify GREEN**

Run: `npm test -- convex/groundedAnswer.test.ts`

Expected: PASS.

## Task 2: Convex Grounded Answer Action

**Files:**
- Create: `convex/ragAnswer.ts`

**Interfaces:**
- Consumes: `api.ragRetrieval.retrieveRelevantChunks`
- Consumes: `requestChatCompletion`
- Produces: `api.ragAnswer.generateGroundedAnswer`

- [ ] **Step 1: Implement action**

Create `generateGroundedAnswer({ question, limit })`. It calls retrieval with the same question and limit, labels results, skips provider call when no evidence exists, otherwise builds prompt messages and calls `requestChatCompletion`.

- [ ] **Step 2: Deploy Convex functions**

Run: `npx convex dev --once`

Expected: Convex accepts the new action and generated API types include `ragAnswer`.

- [ ] **Step 3: Commit backend answer slice**

Run:

```bash
git add convex
git commit -m "feat: add grounded answer action"
```

## Task 3: Next.js Answer Flow And Premium UI

**Files:**
- Create: `src/lib/rag/grounded-answer.ts`
- Modify: `src/app/actions.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/rag-visibility-dashboard.test.tsx`
- Modify: `src/components/rag-visibility-dashboard.tsx`

**Interfaces:**
- Consumes: `api.ragAnswer.generateGroundedAnswer`
- Produces: answer workspace in the dashboard.

- [ ] **Step 1: Write failing dashboard tests**

Update tests to expect:

- Button text `Generate answer`.
- Answer panel text from `groundedAnswer.answer`.
- Citation label `[1]` with source and section.
- Retrieved evidence remains visible with score.
- Setup state before embeddings exist.

- [ ] **Step 2: Run dashboard tests to verify RED**

Run: `npm test -- src/components/rag-visibility-dashboard.test.tsx`

Expected: FAIL because answer props/UI do not exist.

- [ ] **Step 3: Add UI types and page action**

Create `src/lib/rag/grounded-answer.ts` with the response/result types. Add `generateGroundedAnswerAction(formData)` that redirects empty questions to `/?answerError=empty` and valid questions to `/?question=...`.

- [ ] **Step 4: Update page server flow**

Update `src/app/page.tsx` to call `fetchAction(api.ragAnswer.generateGroundedAnswer, { question, limit: 5 })` when a question is submitted and embeddings exist.

- [ ] **Step 5: Update dashboard UI**

Render a premium answer panel with the final answer, model name, citation chips, and the cited evidence list below it.

- [ ] **Step 6: Run dashboard tests to verify GREEN**

Run: `npm test -- src/components/rag-visibility-dashboard.test.tsx`

Expected: PASS.

## Task 4: Docs, Verification, Real Answer Call, And Final Commit

**Files:**
- Create: `docs/learning/06-grounded-answer-generation.md`
- Modify: `README.md`

**Interfaces:**
- Produces: learning documentation for grounded answer generation.

- [ ] **Step 1: Add learning note**

Explain retrieval score, evidence prompts, citations, refusal, and why grounding reduces hallucination risk.

- [ ] **Step 2: Update README**

Set current phase to grounded answer generation and add the new answer-generation bullets.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run lint
npm run build
```

Expected: all pass.

- [ ] **Step 4: Verify real grounded answer**

Run:

```bash
npx convex run ragAnswer:generateGroundedAnswer '{"question":"Can a customer return an opened product?","limit":5}'
```

Expected: returns an answer, answer model, and cited evidence.

- [ ] **Step 5: Browser smoke check**

Open `http://localhost:3000/?question=Can%20a%20customer%20return%20an%20opened%20product%3F`, verify the answer panel and cited evidence render, and check desktop/mobile overflow.

- [ ] **Step 6: Commit final docs/UI changes**

Run:

```bash
git add src docs README.md
git commit -m "feat: add grounded answer dashboard"
```
