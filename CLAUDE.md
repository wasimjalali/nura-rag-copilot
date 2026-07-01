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
2. Reads embedding storage status and, when a `?question=` param is present, the grounded answer, from Convex via `convex/nextjs` (`fetchQuery` / `fetchAction`).
3. Passes everything as props to `RagVisibilityDashboard` (the one big client component).

Chat is **single-shot, not streaming**: the composer is a `<form>` whose action (`generateGroundedAnswerAction` in `src/app/actions.ts`) `redirect()`s to `/?question=...`. That soft navigation re-runs `page.tsx` server-side, which returns the answer as props. Because the redirect is a soft nav (the dashboard has no key), loading state is driven by `useFormStatus().pending` inside the form rather than local state, which resets automatically after the round-trip. `embedSyntheticDocumentsAction` and `addSyntheticDocumentAction` instead `revalidatePath("/")` (no redirect), so client view state is preserved.

### The two-layer RAG code

- `convex/` holds the real backend logic: `ragStorage.ts` (status query + storage mutations), `ragEmbedding.ts` (embed chunks), `ragRetrieval.ts` (embed a question, run vector search), `ragAnswer.ts` (prompt `gpt-5.4-mini`, validate citations, insufficient-evidence fallback). `answerProvider.ts` / `embeddingProvider.ts` wrap Foundry. Vector index `by_embedding` (1536 dims) is defined in `convex/schema.ts`.
- `src/lib/rag/` holds the client/server-shared pieces: document loading, chunking, embedding config, retrieval formatting, storage-record shaping, and the **shared TypeScript types** (`grounded-answer.ts`, `types.ts`). Note `convex/groundedAnswer.ts` (logic) and `src/lib/rag/grounded-answer.ts` (types) are distinct files.

### Citation model (non-obvious)

`convex/ragAnswer.ts` labels **every** retrieved chunk `[1]..[N]` and the model embeds those markers in its prose. The UI then: strips the raw `[n]` markers from paragraph text (`stripCitationMarkers`) and renders its own clickable chips; and the Sources panel shows only the chunks actually cited, not all retrieved (`filterCitedEvidence`). So "cited" (shown) and "retrieved" (labeled) counts differ on purpose.

### UI and design system

`src/components/rag-visibility-dashboard.tsx` is the whole workspace (nav rail, chat, sources panel, chunk dialog, and the knowledge/retrieval/evaluations/settings views). `src/components/nura-logo.tsx` is the Constellation mark; `src/components/icons.tsx` is the hand-rolled icon set; `src/app/icon.svg` is the favicon.

Design tokens are role-named (surface, ink, accent, border, semantic) in `src/app/globals.css`. **Cascade gotcha:** component classes must live in `@layer components` and base resets in `@layer base` so Tailwind utilities can override them; unlayered rules beat every utility (this caused a real double-border and a stuck `hidden` bug). Dialogs render through a portal to `document.body` so they can never become flex items. Fonts are self-hosted via `next/font` in `src/app/layout.tsx` (`--font-inter`, `--font-jetbrains-mono`).

### Where things live

- `content/synthetic-docs/` - the only data source (synthetic support docs)
- `src/lib/eval/manual-eval-set.ts` - the manual evaluation battery rendered in the Evaluations view
- `docs/` - dated build journal (learning notes, design specs, plans); point-in-time records, not living docs
