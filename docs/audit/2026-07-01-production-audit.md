# Nura RAG Copilot - Production-Grade Audit & Plan

Date: 2026-07-01
Method: 5 parallel read-only audit agents (backend, frontend flow, RAG lib, UI, build/tests/config) + a live browser walkthrough of every view and the core user scenarios (cited answer, refusal, add-doc, mobile).

Baseline health: `tsc --noEmit` clean, `eslint` clean (1 warning outside app source), **38/38 tests pass**, `npm audit` 0 vulns, zero `any`, zero `console.*`, zero secrets in source. The codebase is already in good shape; this audit is about hardening it to production grade.

Severity: **C**ritical / **H**igh / **M**edium / **L**ow. IDs are grouped by layer (BE=backend, FE=frontend flow, LIB=rag lib, UI=components, CFG=build/config).

---

## 1. Bugs found

### High

- **BE-H1 - Orphaned chunks are never deleted.** `convex/ragStorage.ts:91-150`. `upsertPreviewRecords` upserts chunks by positional id but never deletes chunks a shrunken/edited document no longer produces. Old high-numbered chunks keep stale text + stale embeddings, still get vector-matched and cited, and `getStorageStatus` over-reports counts. Fix: after upsert, delete chunks for that source whose id isn't in the incoming set (same mutation, transactional).
- **BE-H2 - Stale embedding survives a text edit.** `convex/ragStorage.ts:123-143`. Patching a chunk's `text` doesn't clear its `embedding`. If the re-embed then fails, the chunk holds NEW text paired with the OLD vector - retrieval matches wrong semantics and cites contradictory text. Fix: clear `embedding`/`embeddedAt` when text changes (mark "needs re-embed").
- **BE-H3 / BE-M5 - No relevance floor on vector search, so the deterministic refusal path is unreachable.** `convex/ragRetrieval.ts:86-117`, `convex/ragAnswer.ts:97-113`. Search always returns up to `limit` matches regardless of score; refusal is gated only on `length === 0`, so "insufficient evidence" is left entirely to the LLM. Verified in browser: an out-of-scope question ("mortgage interest rate?") returned 5 weak chunks and the model (correctly, this time) refused - but the guardrail shouldn't depend on the model. Fix: apply a tuned minimum-score floor; if nothing clears it, return 0 results so the deterministic refusal fires.
- **LIB-H1 - `sourceSlug` is case-destructive.** `src/lib/rag/chunk.ts:118-120`. Regex `[^a-z0-9]+` has no `i` flag and no `.toLowerCase()`, so uppercase letters are deleted, not folded: `"Return-Policy.md"` -> `"_eturn_olicy"`, `"README.md"` -> `"_"`. Latent (all 10 current files are lowercase) but the moment a mixed-case filename is added, chunk ids collide and one file's chunks silently overwrite another's via the `by_chunk_id` unique upsert. Fix: `.replace(/\.md$/i,"").toLowerCase().replace(...)` + assert slug uniqueness across the corpus (fail loud).
- **LIB-H2 - Chunker splits on `##` inside fenced code blocks.** `src/lib/rag/chunk.ts:36-61`. No fence awareness: a `## ...` line inside a ``` fence is treated as a section boundary, fabricating bogus sections and truncating real ones. Latent (no current doc has fences) but unguarded, and file upload makes arbitrary markdown likely. Fix: track fence state, skip heading detection inside fences.
- **FE-H1 - No length cap on the question; it's carried entirely in the URL.** `src/app/actions.ts:49-57`, composer `<textarea>` has no `maxLength`. A large paste becomes a giant `GET /?question=...` that can 431/truncate at a proxy before the page runs, and is shipped to the embeddings API uncapped. Fix: `maxLength` on the textarea + server-side length guard before building the redirect, reusing the existing `?answerError=` pattern.
- **FE-H2 - `embedSyntheticDocumentsAction` has zero error handling.** `src/app/actions.ts:27-37`. If Convex/Foundry throws, it's an unhandled rejection with no boundary and no UI feedback - the button just stops spinning as if it succeeded. Contrast: the add-doc dialog wraps its action in try/catch. Fix: wrap it and surface an error (banner or `?embedError=`).
- **UI-H2 - `aria-live="polite"` wraps the whole chat column including the 850ms stepper.** `rag-visibility-dashboard.tsx:481,652-713`. Screen readers get a rapid-fire stream of step labels plus full answer re-announcements. Fix: scope the live region to the answer/error node; `aria-hidden` the stepper.
- **UI-H3 - Sources panel has no accessible name and never receives focus.** `rag-visibility-dashboard.tsx:851-955`. On mobile it overlays the chat but keyboard focus stays behind the scrim. Fix: `aria-label="Sources"`, move focus in on open, restore on close (mirror the Dialog pattern).
- **UI-H1 - Composer may keep the previous question after the answer returns.** `rag-visibility-dashboard.tsx:404,770-796` (static analysis). NOTE: **not reproduced in the live browser** - both the suggested-chip path and a hand-typed question left the composer empty after the round-trip. Action: verify in code whether an effect already clears it; if the controlled `question` state can survive the soft nav, add a clear-on-`submittedQuestion`-change effect. Downgraded pending code re-verification.

### Medium

- **BE-M1 - No concurrent-run lock on embedding.** `convex/ragEmbedding.ts` / `ragStorage.ts:152-168`. Double-click embeds the whole corpus twice (double cost, garbled run log). Fix: reject start if a non-stale run is `running`.
- **BE-M2 - `getStorageStatus` `.collect()`s full tables on every page load.** `convex/ragStorage.ts:56-88`, called on every `force-dynamic` render. Pulls all chunk `text` to compute 3 ints + 1 timestamp; scales badly with corpus + BE-H1 orphans. Fix: avoid materializing `text` (select ids) or keep a stats counter.
- **BE-M4 - Foundry embedding call: no timeout, no retry, no batch cap.** `convex/embeddingProvider.ts:45-95`. Whole corpus in one request; all-or-nothing past Azure's limit; can hang with no abort. Fix: batch input, add `AbortController` timeout to both fetches.
- **FE-M1/M2 - Corpus reloaded+rechunked from disk on every request, sequentially with the Convex fetch.** `src/app/page.tsx:29-39`. Wasted I/O per chat turn + a needless latency waterfall. Fix: `Promise.all` the disk load and status fetch; the answer path doesn't need chunks.
- **LIB-M1/M2 - Chunker edge cases undocumented/untested:** H3+ and setext headings silently absorbed; pre-`##` preamble bucketed as literal `"Overview"` (collides with a real `## Overview`). Fix: use a distinct sentinel for preamble; document the "H2 is the structural unit" assumption.
- **UI-M1 - Generation stepper frozen at step 0 under `prefers-reduced-motion`.** `rag-visibility-dashboard.tsx:655-666`. Reads as broken (stuck ring, grey dots, never completes). Fix: render a static "Generating..." line or advance without animation.
- **UI-M2 - "Related" questions render after an insufficient-evidence refusal**, undercutting the guardrail. Verified in browser. Fix: hide Related when `answerType === "insufficient_evidence"`.
- **UI-M3 - "Related" is a static `.slice(0,3)` of the pool, not actually related.** Fix: rename to "Try asking" or drop.
- **UI-M4 - Mobile nav drawer has no focus trap / focus management.** `rag-visibility-dashboard.tsx:170-193`. Fix: reuse the Dialog focus pattern; add `aria-label`.
- **CFG-M4 - Dead component `FoundationOverview`** (+ its test) is imported nowhere. **CFG-M5 - Dead Convex table `projectNotes`** has no reads/writes. Fix: delete both (confirm intent).

### Low (selected)

- **UI-refusal polish (browser finding):** a refusal renders inline citation chips `[1]..[5]` and a "Sources 5" toggle, which reads as a grounded answer. Consider suppressing/relabeling citations on refusals.
- **UI-L3** - no `break-words` on user bubble / answer / mono ids -> long tokens can force horizontal scroll.
- **UI-L4** - dashboard Escape handler also closes panels behind an open Dialog.
- **UI-L6** - Evaluations view shows decorative green checks implying "passed" though nothing runs (misleading on a portfolio).
- **UI-L8** - repeated `aria-label="Nura"` on every avatar -> repeated SR announcements; make inline avatars `aria-hidden`.
- **BE-L4 / FE-L3** - upstream Foundry error messages surfaced verbatim to the UI (no secret leak confirmed; info-disclosure hygiene).
- **LIB-L3** - `vector-validation.ts` checks length only, not NaN/Infinity elements.
- **CFG-L1/L2** - `eslint.config.mjs` doesn't ignore `.remember/**`; `.playwright-mcp/` not gitignored.
- **CFG-L5/L6** - no `error.tsx`/`loading.tsx`; no security headers (matters pre-deploy).
- **LIB-H1 sibling / M4/M5** - `src/lib/rag/retrieval.ts` core logic (`validateRetrievalQuestion`, `clampRetrievalLimit`, `buildRetrievalResults`) is **dead code**; `convex/ragRetrieval.ts` reimplements it inline. Tests give false confidence. Fix: delete dead exports (keep `formatRetrievalScore`) or share the module.

### Verified correct (no action)
No XSS anywhere (all text is React children, no `dangerouslySetInnerHTML`). No open redirect. Path-traversal guard in `addSyntheticDocumentAction` is correct. Citation label math is 1-indexed, contiguous, dedup'd. Prompt-injection hardening blocks label-level citation spoofing (semantic spoofing remains an inherent LLM limitation, acceptable for synthetic single-user scope). Convex action/mutation/vectorSearch usage is correct.

### Environment note (not a code bug)
Two dev servers are running: **:3000 is a hung/zombie process** (requests time out, HTTP 000) and **:3001 is the live app** (200 in ~0.45s). Recommend killing the stale :3000 process. The console showed only stale Fast-Refresh HMR errors from an earlier edit state; the live app renders clean.

---

## 2. Enhancements toward production grade

1. **File upload for the knowledge base** (user request): accept `.md` / `.markdown` / `.txt` uploads (drag-drop + file picker) in the Add-document dialog, in addition to paste. **PDF** upload as the priority follow-on (requires a PDF text-extraction dependency).
2. **Retrieval quality guardrail:** the score floor (BE-H3) is both a bug fix and a quality upgrade - it makes refusals trustworthy.
3. **Robustness:** batching + timeout on embeddings (BE-M4), concurrent-run lock (BE-M1), error surfaces for every server action (FE-H2), an `error.tsx` boundary (CFG-L5).
4. **Accessibility pass:** live-region scoping, focus management for panel + mobile drawer, reduced-motion stepper, aria-hidden decorative avatars, break-words.
5. **Honesty of the Evaluations view:** either make it actually run, or stop implying passed checks.
6. **Test coverage:** add unit tests for chunking edge cases, `sourceSlug`, the score floor, and server-action validation (currently the real Convex orchestration + `actions.ts` are untested).
7. **Repo hygiene:** delete dead code (`FoundationOverview`, `projectNotes`, dead retrieval exports), gitignore `.playwright-mcp/`, eslint-ignore `.remember/**`, add `engines`.
8. **Learning-only UI:** decide what to keep for the portfolio vs. trim (see plan).

---

## 3. Implementation plan (phased, sub-agent driven)

**Phase A - Backend correctness & robustness** (opus/sonnet): BE-H1, BE-H2, BE-H3, BE-M1, BE-M4, BE-M2. New tests for score floor + orphan cleanup.
**Phase B - RAG lib correctness** (sonnet): LIB-H1 (slug), LIB-H2 (fences), LIB-M1/M2 (headings/preamble), delete dead retrieval exports, shared word-count util. New `chunk.test.ts` with edge cases.
**Phase C - Frontend flow** (sonnet): FE-H1 (length cap), FE-H2 (embed error handling), FE-M1/M2 (parallelize/defer load), `error.tsx`, actions tests.
**Phase D - File upload feature** (opus): md/txt upload pipeline + dialog UI; PDF per decision below.
**Phase E - UI correctness & a11y** (opus): UI-H1 (verify+fix), UI-H2, UI-H3, UI-M1, UI-M2/M3, UI-M4, refusal polish, break-words, Escape/Dialog, avatars.
**Phase F - Learning-UI decision + honesty** (opus): apply the trimming/Evaluations decision.
**Phase G - Hygiene** (haiku/sonnet): delete dead code, gitignore, eslint ignore, engines.
**Phase H - Verify + adversarial review** (5 opus skeptics): re-run tsc/lint/tests, re-verify in browser, then PR.

Each phase ends green (`tsc` + `lint` + `test`). Critical/security-sensitive changes (backend mutations, server actions) get the adversarial review per house rules before the PR.

---

## 4. Decisions (confirmed by Wasim 2026-07-01)
1. **Lean production** UI. Remove the Retrieval explainer view, the Settings diagnostics view, the 5-step generation stepper (-> clean spinner), and the "Related" questions block. Keep Chat (with sources panel + chunk dialog + scores), Knowledge base (+ upload).
2. **PDF now**: install `unpdf` (pure-JS, serverless-safe) and ship `.md`/`.markdown`/`.txt` + PDF upload together.
3. **Evaluations run live**: this overrides the "lean" removal for that one view. Build a real eval runner (deterministic assertions per item) with a "Run evals" button and true pass/fail. Final nav: **Chat | Knowledge base | Evaluations**.
