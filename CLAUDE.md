# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The project rules, safety constraints, RAG rules, and non-goals live in `AGENTS.md` and apply here:

@AGENTS.md

## Commands

```bash
npm run dev          # Next dev server (Turbopack)
npm run build        # production build
npm run lint         # eslint
npm test             # vitest run (all tests, jsdom)
npm run test:watch   # vitest watch
npx tsc --noEmit     # typecheck
npx convex dev       # one-time interactive Convex setup; generates convex/_generated
```

Run a single test file or filter by name:

```bash
npx vitest run src/lib/rag/retrieval.test.ts
npm test -- retrieval
```

"Done" means `npx tsc --noEmit` is clean, `npm run lint` is clean, and `npm test` passes. Tests are co-located next to source as `*.test.ts` / `*.test.tsx`.

## Architecture

Next.js App Router frontend, Convex backend (database + vector search), Microsoft Foundry for embeddings and chat. The RAG loop is built directly, without RAG frameworks.

### Request and data flow (non-obvious)

`src/app/page.tsx` is a `force-dynamic` server component. On each request it:
1. Loads synthetic markdown from `content/synthetic-docs` (`src/lib/rag/load-documents.ts`) and chunks it by section heading (`src/lib/rag/chunk.ts`).
2. Reads embedding storage status from Convex via `convex/nextjs` (`fetchQuery`).
3. Passes the corpus, status and the server actions (including `askGroundedQuestion`) as props to `RagVisibilityDashboard` (the one big client component).

Chat is **client-managed and multi-turn** (single-shot per request, not streaming). The composer calls the `askGroundedQuestion` server action directly (`src/app/actions.ts`), which forwards `{ question, history }` to `convex/ragAnswer.ts` and returns the grounded answer; the dashboard appends it to an in-memory `turns` transcript and drives loading from a `pendingQuestion` flag (not `useFormStatus`, and no `?question=` redirect). Recent turns are sent as `history` so follow-ups resolve, and `convex/ragAnswer.ts` bounds that window (`MAX_HISTORY_TURNS`) and contextualizes the retrieval query for short follow-ups. A `conversationRef` guard drops a stale answer if the user starts a new chat mid-request. `embedSyntheticDocumentsAction` and `addSyntheticDocumentAction` still `revalidatePath("/")` (no redirect), so client view state is preserved.

**Chat history** is persisted client-side in `localStorage` (`src/lib/rag/chat-history.ts`), not in Convex (a server-side store is overkill for this single-user tool). Conversations (full turns, so resume restores answers + evidence) are listed in the nav rail's "Recent" section; New chat resets the transcript and starts a fresh conversation on the next answered turn.

### The two-layer RAG code

- `convex/` holds the real backend logic: `ragStorage.ts` (status query + storage mutations; `upsertPreviewRecords` full-reconciles storage to the incoming corpus, deleting orphaned chunks and clearing a chunk's embedding when its text changes), `ragEmbedding.ts` (embed chunks; refuses an empty corpus), `ragRetrieval.ts` (embed a question, run vector search, drop matches below `MIN_RELEVANCE_SCORE = 0.35` so a question with no relevant evidence deterministically refuses), `ragAnswer.ts` (prompt `gpt-5.4-mini`, validate citations, insufficient-evidence fallback). `answerProvider.ts` / `embeddingProvider.ts` wrap Foundry (batched embeddings, `AbortController` timeouts). Vector index `by_embedding` (1536 dims) is defined in `convex/schema.ts`.
- `src/lib/rag/` holds the client/server-shared pieces: document loading, chunking, embedding config, retrieval formatting, storage-record shaping, and the **shared TypeScript types** (`grounded-answer.ts`, `types.ts`). Note `convex/groundedAnswer.ts` (logic) and `src/lib/rag/grounded-answer.ts` (types) are distinct files.

### Citation model (non-obvious)

`convex/ragAnswer.ts` labels **every** retrieved chunk `[1]..[N]` and the model embeds those markers in its prose. The UI then: strips the raw `[n]` markers from paragraph text (`stripCitationMarkers`) and renders its own clickable chips; and the Sources panel shows only the chunks actually cited, not all retrieved (`filterCitedEvidence`). So "cited" (shown) and "retrieved" (labeled) counts differ on purpose.

### UI and design system

`src/components/rag-visibility-dashboard.tsx` is the whole workspace (nav rail, chat, sources panel, chunk dialog, and the knowledge and evaluations views). The nav is deliberately lean (Chat, Knowledge base, Evaluations); the earlier Retrieval and Settings explainer views were removed. The Knowledge base accepts pasted text and `.md`/`.markdown`/`.txt`/`.pdf` uploads (`src/lib/rag/extract-upload.ts`, PDF via `unpdf`) and auto-embeds on add. The Evaluations view runs the manual battery live against the real RAG loop (`runEvalsAction` in `src/app/eval-actions.ts`, deterministic assertions in `src/lib/eval/run-eval.ts`) and reports real pass/fail. `src/components/nura-logo.tsx` is the Constellation mark; `src/components/icons.tsx` is the hand-rolled icon set; `src/app/icon.svg` is the favicon.

Design tokens are role-named (surface, ink, accent, border, semantic) in `src/app/globals.css`. **Cascade gotcha:** component classes must live in `@layer components` and base resets in `@layer base` so Tailwind utilities can override them; unlayered rules beat every utility (this caused a real double-border and a stuck `hidden` bug). Dialogs render through a portal to `document.body` so they can never become flex items. Fonts are self-hosted via `next/font` in `src/app/layout.tsx` (`--font-inter`, `--font-jetbrains-mono`).

### Where things live

- `content/synthetic-docs/` - the only data source (synthetic support docs)
- `src/lib/eval/manual-eval-set.ts` - the eval battery (questions + machine-checkable `assertion`s) the Evaluations view runs live; `src/lib/eval/run-eval.ts` holds the pure assertion logic
- `docs/` - dated build journal (learning notes, design specs, plans); point-in-time records, not living docs
