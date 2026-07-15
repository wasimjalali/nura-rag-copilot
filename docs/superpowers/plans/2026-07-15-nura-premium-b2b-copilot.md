# Nura Premium B2B Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Nura into a premium, production-oriented B2B RAG workspace with modular UI, server-owned conversations, persisted evaluations, safe corpus activation, incremental embeddings, resilience and operational visibility.

**Architecture:** Keep the framework-free RAG loop and Next.js plus Convex stack. Split the current dashboard by feature ownership, move durable state into Convex and introduce immutable corpus versions so answer retrieval never reads partially updated data. Each client receives a separate deployment, with an auth guard that supports Convex identity in production and an explicit local development mode.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Convex, Azure OpenAI or Microsoft Foundry, Vitest and Testing Library.

## Global Constraints

- Use `npm` only. Do not install packages without separate approval.
- Do not read or modify `.env*` files.
- Keep synthetic documents only.
- Keep the core RAG loop framework-free.
- Do not add billing, public signup, tenant switching, reranking, hybrid search, GraphRAG, autonomous agents or fine-tuning.
- Each B2B client receives a separate application, Convex deployment and model credential set.
- Preserve the existing cool-neutral palette, navy brand and single blue accent.
- Do not add gradients, glass effects, purple family colors, decorative textures or glow effects.
- Use Inter for interface text and JetBrains Mono only for IDs and technical metadata.
- Every behavior change follows red, green and refactor.
- Run `npx tsc --noEmit`, `npm run lint`, `npm test` and `npm run build` before PR creation.
- Run adversarial review before critical auth, data, action and secrets-handling changes are considered complete.

---

## File structure

### New frontend modules

- `src/components/workspace/workspace-shell.tsx`: stable desktop and mobile application shell.
- `src/components/workspace/workspace-nav.tsx`: navigation, conversation list and readiness status.
- `src/components/chat/chat-workspace.tsx`: chat orchestration and active-turn state.
- `src/components/chat/chat-composer.tsx`: composer input and submission state.
- `src/components/chat/conversation-turn.tsx`: user and assistant turn rendering.
- `src/components/chat/evidence-inspector.tsx`: cited and retrieved evidence views.
- `src/components/knowledge/knowledge-workspace.tsx`: document inventory, search and ingestion UI.
- `src/components/evaluations/evaluations-workspace.tsx`: persisted run history and case details.
- `src/components/ui/dialog.tsx`: accessible shared dialog implementation.
- `src/components/ui/status-label.tsx`: semantic compact status control.
- `src/lib/nura-config.ts`: one safe customization boundary for client name, terminology and feature labels.

### New backend modules

- `convex/auth.ts`: shared identity and role guard.
- `convex/conversations.ts`: conversation and message persistence.
- `convex/evaluations.ts`: evaluation run persistence.
- `convex/corpusVersions.ts`: draft, ready, active and failed corpus lifecycle.
- `convex/operations.ts`: safe operational records.
- `convex/providerRetry.ts`: bounded retry policy.
- `src/lib/rag/app-errors.ts`: stable public error-code model.

### Existing modules retained and changed

- `src/components/rag-visibility-dashboard.tsx`: reduced to compatibility composition, then removed after callers and tests migrate.
- `src/app/page.tsx`: loads the new shell and initial server data.
- `src/app/actions.ts`: uses conversation IDs and typed errors instead of browser-supplied history.
- `src/app/eval-actions.ts`: creates and updates persisted evaluation runs.
- `src/app/globals.css`: refined tokens and shared interaction styles.
- `convex/schema.ts`: adds conversations, messages, corpus versions, evaluation runs and operation records.
- `convex/ragAnswer.ts`: server-owned context, active-version retrieval and operation metrics.
- `convex/ragRetrieval.ts`: active corpus filtering.
- `convex/ragEmbedding.ts`: draft-version incremental embedding flow.
- `convex/ragStorage.ts`: version-scoped storage mutations.
- `convex/answerProvider.ts` and `convex/embeddingProvider.ts`: retry integration and typed provider errors.
- `README.md`, `AGENTS.md` and `convex/README.md`: updated behavior and deployment guidance.

---

### Task 1: Decompose the workspace without changing behavior

**Files:**
- Create: `src/components/workspace/workspace-shell.tsx`
- Create: `src/components/workspace/workspace-nav.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/status-label.tsx`
- Create: `src/lib/nura-config.ts`
- Create: `src/lib/nura-config.test.ts`
- Modify: `src/components/rag-visibility-dashboard.tsx`
- Modify: `src/components/rag-visibility-dashboard.test.tsx`

**Interfaces:**
- Produces `WorkspaceView = "chat" | "knowledge" | "evaluations"`.
- Produces `WorkspaceShellProps` with `activeView`, `onSelectView`, `navigation`, `children` and optional `inspector`.
- Produces reusable `Dialog` and `StatusLabel` components used by later tasks.
- Produces `NuraClientConfig` and `DEFAULT_NURA_CONFIG` used by the shell, chat and documentation.

- [ ] **Step 1: Add failing shell and primitive tests**

Add tests that assert navigation exposes `aria-current`, the mobile drawer restores focus and the shared dialog traps focus and closes on Escape.

```tsx
it("marks the active workspace and changes views", async () => {
  const user = userEvent.setup();
  render(<WorkspaceShellHarness />);
  expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute("aria-current", "page");
  await user.click(screen.getByRole("button", { name: "Knowledge base" }));
  expect(screen.getByRole("button", { name: "Knowledge base" })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 2: Run the targeted test and verify red**

Run: `npm test -- src/components/rag-visibility-dashboard.test.tsx`

Expected: failure because `WorkspaceShell`, `Dialog` and `StatusLabel` do not exist.

- [ ] **Step 3: Extract the shell, navigation and primitives**

Use these contracts:

```ts
export type WorkspaceView = "chat" | "knowledge" | "evaluations";

export type WorkspaceShellProps = {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  navigation: React.ReactNode;
  inspector?: React.ReactNode;
  children: React.ReactNode;
};

export type StatusTone = "neutral" | "success" | "warning" | "danger";
```

Move code without changing labels, actions or state ownership. Keep the existing dashboard as the coordinator. Replace duplicated brand and terminology strings with this explicit safe configuration:

```ts
export type NuraClientConfig = {
  productName: string;
  productSubtitle: string;
  supportRoleLabel: string;
  knowledgeLabel: string;
  evaluationsLabel: string;
};

export const DEFAULT_NURA_CONFIG: NuraClientConfig = {
  productName: "Nura",
  productSubtitle: "RAG Copilot",
  supportRoleLabel: "Support agent",
  knowledgeLabel: "Knowledge base",
  evaluationsLabel: "Evaluations",
};
```

- [ ] **Step 4: Run targeted tests and TypeScript**

Run: `npm test -- src/components/rag-visibility-dashboard.test.tsx src/lib/nura-config.test.ts && npx tsc --noEmit`

Expected: all targeted tests pass and TypeScript exits zero.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace src/components/ui src/lib/nura-config* src/components/rag-visibility-dashboard.tsx src/components/rag-visibility-dashboard.test.tsx
git commit -m "refactor: split workspace shell and primitives"
```

---

### Task 2: Build the premium chat and provenance experience

**Files:**
- Create: `src/components/chat/chat-workspace.tsx`
- Create: `src/components/chat/chat-composer.tsx`
- Create: `src/components/chat/conversation-turn.tsx`
- Create: `src/components/chat/evidence-inspector.tsx`
- Create: `src/components/chat/chat-workspace.test.tsx`
- Modify: `src/components/rag-visibility-dashboard.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/components/icons.tsx`

**Interfaces:**
- Consumes existing `GroundedAnswerResponse`, `ChatTurn` and `EvidenceItem` shapes.
- Produces `AnswerAction = "copy" | "retry" | "helpful" | "unhelpful"`.
- Produces evidence tabs `"cited" | "retrieved"`.
- Keeps full-chunk focus as the default and highlights a sentence only after deterministic normalized substring matching.

- [ ] **Step 1: Write failing chat interaction tests**

Cover answer copy, retry with the original question, feedback state, cited versus retrieved tabs, descriptive citation names and mobile composer behavior.

```tsx
it("shows cited and retrieved evidence separately", async () => {
  const user = userEvent.setup();
  render(<ChatWorkspaceHarness answer={answerWithFiveRetrievedAndOneCited} />);
  await user.click(screen.getByRole("button", { name: "Sources: 1 cited of 5 retrieved" }));
  expect(screen.getByRole("tab", { name: "Cited 1" })).toHaveAttribute("aria-selected", "true");
  await user.click(screen.getByRole("tab", { name: "Retrieved 5" }));
  expect(screen.getAllByRole("button", { name: /View full chunk/ })).toHaveLength(5);
});
```

- [ ] **Step 2: Verify the tests fail for missing modules**

Run: `npm test -- src/components/chat/chat-workspace.test.tsx`

Expected: failure because chat feature modules do not exist.

- [ ] **Step 3: Implement feature modules and migrate chat rendering**

Use an explicit feedback state local to each assistant turn:

```ts
export type AnswerFeedback = "helpful" | "unhelpful" | null;

export type EvidenceTab = "cited" | "retrieved";

export function normalizeForEvidenceMatch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
```

The source trigger accessible name must be `Sources: {cited} cited of {retrieved} retrieved`. Citation controls must name the source and section. Do not expose model reasoning.

- [ ] **Step 4: Refine the responsive visual system**

Update role tokens and shared classes only. Maintain one blue accent, hairline separation and reduced-motion behavior. At 390px, stack prompt suggestions, reduce composer height and keep all touch targets at least 40px.

- [ ] **Step 5: Run chat tests, existing component tests and TypeScript**

Run: `npm test -- src/components/chat/chat-workspace.test.tsx src/components/rag-visibility-dashboard.test.tsx && npx tsc --noEmit`

Expected: all selected tests pass and TypeScript exits zero.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat src/components/rag-visibility-dashboard.tsx src/components/icons.tsx src/app/globals.css
git commit -m "feat: add premium chat provenance experience"
```

---

### Task 3: Upgrade Knowledge base and Evaluations workspaces

**Files:**
- Create: `src/components/knowledge/knowledge-workspace.tsx`
- Create: `src/components/knowledge/knowledge-workspace.test.tsx`
- Create: `src/components/evaluations/evaluations-workspace.tsx`
- Create: `src/components/evaluations/evaluations-workspace.test.tsx`
- Modify: `src/components/rag-visibility-dashboard.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces `DocumentStatus = "active" | "processing" | "needs_indexing" | "failed"`.
- Knowledge filtering is client-side until persisted corpus records arrive in Task 5.
- Evaluations keep the previous completed result visible while a new run is pending.

- [ ] **Step 1: Write failing workspace tests**

```tsx
it("filters documents by title, source and status", async () => {
  const user = userEvent.setup();
  render(<KnowledgeWorkspace {...fixtureProps} />);
  await user.type(screen.getByRole("searchbox", { name: "Search documents" }), "return");
  expect(screen.getByRole("row", { name: /Return Policy/ })).toBeInTheDocument();
  expect(screen.queryByRole("row", { name: /Shipping Policy/ })).not.toBeInTheDocument();
});

it("keeps the previous evaluation result while rerunning", async () => {
  render(<EvaluationsWorkspace initialRun={passingRun} runAction={pendingRunAction} />);
  await userEvent.click(screen.getByRole("button", { name: "Run evaluations" }));
  expect(screen.getByText("10/10 checks passed")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Running 10 checks");
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- src/components/knowledge/knowledge-workspace.test.tsx src/components/evaluations/evaluations-workspace.test.tsx`

Expected: failure because both workspaces are missing.

- [ ] **Step 3: Implement Knowledge base inventory**

Render a semantic desktop table and mobile stacked rows from the same data. Add search, status filtering, sort, document detail and ingestion status. Keep Add document as the only primary action.

- [ ] **Step 4: Implement evaluation history-ready UI**

Render latest summary, category filters and mobile-safe case rows. Use `initialRun` now and accept a `history` array so Task 4 can connect persisted runs without redesigning the component API.

```ts
export type EvaluationWorkspaceProps = {
  initialRun: EvalRunResult | null;
  history: EvalRunResult[];
  runAction: () => Promise<EvalRunResult>;
};
```

- [ ] **Step 5: Run targeted tests and responsive component assertions**

Run: `npm test -- src/components/knowledge/knowledge-workspace.test.tsx src/components/evaluations/evaluations-workspace.test.tsx src/components/rag-visibility-dashboard.test.tsx`

Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/knowledge src/components/evaluations src/components/rag-visibility-dashboard.tsx src/app/globals.css
git commit -m "feat: upgrade knowledge and evaluation workspaces"
```

---

### Task 4: Add typed errors, provider retries and safe operational records

**Files:**
- Create: `src/lib/rag/app-errors.ts`
- Create: `src/lib/rag/app-errors.test.ts`
- Create: `convex/providerRetry.ts`
- Create: `convex/providerRetry.test.ts`
- Create: `convex/operations.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/answerProvider.ts`
- Modify: `convex/embeddingProvider.ts`
- Modify: `src/app/actions.ts`
- Modify: `src/app/eval-actions.ts`

**Interfaces:**
- Produces `AppErrorCode` and `PublicAppError`.
- Produces `withProviderRetry<T>(operation, options)` with three total attempts.
- Operation records never store full prompts, source text or credentials.

- [ ] **Step 1: Write failing typed-error and retry tests**

```ts
it("retries transient failures and respects the attempt cap", async () => {
  let attempts = 0;
  const result = await withProviderRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw providerError(429, "busy");
    return "ok";
  }, { sleep: async () => undefined });
  expect(result).toBe("ok");
  expect(attempts).toBe(3);
});

it("does not retry authentication failures", async () => {
  let attempts = 0;
  await expect(withProviderRetry(async () => {
    attempts += 1;
    throw providerError(401, "unauthorized");
  }, { sleep: async () => undefined })).rejects.toMatchObject({ status: 401 });
  expect(attempts).toBe(1);
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- src/lib/rag/app-errors.test.ts convex/providerRetry.test.ts`

Expected: failure because the modules are missing.

- [ ] **Step 3: Implement stable error contracts**

```ts
export type AppErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "CORPUS_NOT_READY"
  | "PROVIDER_TEMPORARY"
  | "INVALID_MODEL_RESPONSE"
  | "VALIDATION_FAILED"
  | "INTERNAL_ERROR";

export type PublicAppError = {
  code: AppErrorCode;
  message: string;
  retryable: boolean;
};
```

- [ ] **Step 4: Implement bounded provider retry**

Retry network errors, timeouts, 408, 429 and 5xx only. Respect `Retry-After`, otherwise use exponential backoff with jitter. Accept an injected `sleep` and `random` for deterministic tests.

- [ ] **Step 5: Add safe operation records**

Add `operations` with request ID, actor subject when available, operation type, status, corpus version, model identifiers, timings, retrieval summary, retry count, token usage and error code. Do not add fields for prompt or document text.

- [ ] **Step 6: Run targeted and provider tests**

Run: `npm test -- src/lib/rag/app-errors.test.ts convex/providerRetry.test.ts convex/answerProvider.test.ts convex/embeddingProvider.test.ts`

Expected: all selected tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rag/app-errors* convex/providerRetry* convex/operations.ts convex/schema.ts convex/answerProvider.ts convex/embeddingProvider.ts src/app/actions.ts src/app/eval-actions.ts
git commit -m "feat: add provider resilience and typed errors"
```

---

### Task 5: Persist conversations and evaluation runs in Convex

**Files:**
- Create: `convex/auth.ts`
- Create: `convex/conversations.ts`
- Create: `convex/conversations.test.ts`
- Create: `convex/evaluations.ts`
- Create: `convex/evaluations.test.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/ragAnswer.ts`
- Modify: `src/app/actions.ts`
- Modify: `src/app/eval-actions.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/components/chat/chat-workspace.tsx`
- Modify: `src/components/evaluations/evaluations-workspace.tsx`
- Modify: `src/lib/rag/chat-history.ts`

**Interfaces:**
- Production uses `ctx.auth.getUserIdentity()`.
- Local development may use an explicit development actor only when `NURA_ALLOW_ANONYMOUS_DEV` equals `true` in the Convex environment.
- The client sends `conversationId`, `question` and `requestId`, never prior assistant text.

- [ ] **Step 1: Write failing auth and persistence tests**

```ts
it("rejects anonymous production mutations", async () => {
  await expect(requireActor(fakeContext({ identity: null, allowAnonymousDev: false })))
    .rejects.toMatchObject({ code: "AUTH_REQUIRED" });
});

it("deduplicates a retried question by request ID", async () => {
  const first = await createPendingTurn(ctx, input);
  const second = await createPendingTurn(ctx, input);
  expect(second.messageId).toBe(first.messageId);
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- convex/conversations.test.ts convex/evaluations.test.ts`

Expected: failure because persistence modules are missing.

- [ ] **Step 3: Extend the schema**

Add `conversations`, `messages`, `messageEvidence`, `evalRuns` and `evalCaseResults`. Store owner subject, ordered timestamps, request IDs, answer state, model IDs, corpus version and evidence snapshots.

- [ ] **Step 4: Implement the actor guard**

```ts
export type NuraRole = "agent" | "knowledge_manager" | "operator";

export type Actor = {
  subject: string;
  role: NuraRole;
  isDevelopment: boolean;
};
```

Every public query, mutation and action added by this task calls the guard. Development mode uses subject `development-user` and role `operator`.

- [ ] **Step 5: Implement server-owned conversations**

Create or load an authorized conversation, deduplicate by request ID, persist a pending assistant message, load bounded prior turns from Convex and update the message after generation. Persist the exact retrieval snapshot used for the answer.

- [ ] **Step 6: Implement persisted evaluations**

Create a run before execution, append each case result and finalize as `completed`, `failed` or `interrupted`. Query recent runs newest first.

- [ ] **Step 7: Connect the UI and remove localStorage as the source of truth**

Keep `chat-history.ts` only for migration of existing local conversations. Import them once into the development user's backend history, then mark migration complete in localStorage without storing new turns there.

- [ ] **Step 8: Run persistence, action and component tests**

Run: `npm test -- convex/conversations.test.ts convex/evaluations.test.ts src/app/actions.test.ts src/components/chat/chat-workspace.test.tsx src/components/evaluations/evaluations-workspace.test.tsx`

Expected: all selected tests pass.

- [ ] **Step 9: Commit**

```bash
git add convex/auth.ts convex/conversations* convex/evaluations* convex/schema.ts convex/ragAnswer.ts src/app/actions* src/app/eval-actions.ts src/app/page.tsx src/components/chat src/components/evaluations src/lib/rag/chat-history.ts
git commit -m "feat: persist conversations and evaluations"
```

---

### Task 6: Add immutable corpus versions and incremental embeddings

**Files:**
- Create: `convex/corpusVersions.ts`
- Create: `convex/corpusVersions.test.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/ragStorage.ts`
- Modify: `convex/ragEmbedding.ts`
- Modify: `convex/ragRetrieval.ts`
- Modify: `src/lib/rag/chunk.ts`
- Modify: `src/lib/rag/storage-records.ts`
- Modify: `src/app/actions.ts`
- Modify: `src/components/knowledge/knowledge-workspace.tsx`

**Interfaces:**
- Produces corpus states `draft`, `processing`, `ready`, `active`, `failed` and `archived`.
- Produces `CHUNKER_VERSION = "heading-v2"`.
- Reuse key is text hash plus chunker version plus embedding model plus dimensions.
- Only an explicit promote action changes `activeVersionId`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it("keeps the active corpus unchanged when draft embedding fails", async () => {
  const active = await seedActiveCorpus(ctx);
  const draft = await createDraftVersion(ctx, changedCorpus);
  await failVersion(ctx, draft.versionId, "PROVIDER_TEMPORARY");
  expect(await getActiveVersionId(ctx)).toBe(active.versionId);
});

it("reuses only compatible unchanged embeddings", () => {
  expect(canReuseEmbedding(existing, sameTextAndConfig)).toBe(true);
  expect(canReuseEmbedding(existing, differentModel)).toBe(false);
});
```

- [ ] **Step 2: Verify red**

Run: `npm test -- convex/corpusVersions.test.ts`

Expected: failure because corpus lifecycle functions do not exist.

- [ ] **Step 3: Extend the schema for version-scoped data**

Add `corpora` and `corpusVersions`. Add `corpusVersionId`, `textHash` and `chunkerVersion` to document and chunk records. Add vector-index filter fields for the active version lookup.

- [ ] **Step 4: Implement draft building and embedding reuse**

Create new version-scoped records without mutating active records. Copy compatible vectors into the draft and request embeddings only for missing vectors. Verify run ID, expected hash and version state on every embedding write.

- [ ] **Step 5: Implement ready and promote transitions**

Mark a version ready only when every required chunk has a valid vector. Promotion atomically archives the old active version and activates the ready version. Keep recent inactive versions available for rollback.

- [ ] **Step 6: Filter retrieval to the active version**

Resolve the active version before vector search and pass it as the filter. Return `CORPUS_NOT_READY` when no active version exists.

- [ ] **Step 7: Connect Knowledge base lifecycle controls**

Show active, processing, ready and failed states. Add explicit Promote corpus for authorized knowledge managers and operators. The add-document flow builds a draft and never silently activates it.

- [ ] **Step 8: Run lifecycle, retrieval and embedding tests**

Run: `npm test -- convex/corpusVersions.test.ts convex/embeddingProvider.test.ts src/lib/rag/retrieval.test.ts src/lib/rag/storage-records.test.ts src/components/knowledge/knowledge-workspace.test.tsx`

Expected: all selected tests pass.

- [ ] **Step 9: Commit**

```bash
git add convex/corpusVersions* convex/schema.ts convex/ragStorage.ts convex/ragEmbedding.ts convex/ragRetrieval.ts src/lib/rag/chunk.ts src/lib/rag/storage-records* src/app/actions.ts src/components/knowledge
git commit -m "feat: add safe corpus version activation"
```

---

### Task 7: Integrate observability, documentation and final product states

**Files:**
- Modify: `convex/ragAnswer.ts`
- Modify: `convex/ragEmbedding.ts`
- Modify: `convex/operations.ts`
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/chat/chat-workspace.tsx`
- Modify: `src/components/knowledge/knowledge-workspace.tsx`
- Modify: `src/components/evaluations/evaluations-workspace.tsx`
- Modify: `src/app/globals.css`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `convex/README.md`

**Interfaces:**
- Every answer and embedding run receives a request or run ID.
- UI maps stable error codes to recovery copy.
- Documentation distinguishes local development mode from production identity requirements.

- [ ] **Step 1: Write failing operation-summary and error-state tests**

```tsx
it("maps a temporary provider error to a retry action", () => {
  render(<ChatError code="PROVIDER_TEMPORARY" onRetry={onRetry} />);
  expect(screen.getByText("The model service is temporarily unavailable.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Retry answer" })).toBeEnabled();
});
```

Add backend tests asserting operation records include timings and model IDs but do not contain `prompt`, `documentText`, `apiKey` or `sourceText` fields.

- [ ] **Step 2: Verify red**

Run: `npm test -- src/components/chat/chat-workspace.test.tsx convex/providerRetry.test.ts`

Expected: new error-state and operation-summary assertions fail.

- [ ] **Step 3: Record answer, embedding and evaluation summaries**

Persist status, actor, corpus version, model IDs, retrieval count, top score, stage timings, retries, token usage and safe error code. Do not persist complete prompts or document text.

- [ ] **Step 4: Finish product states and copy**

Add direct recovery actions for corpus-not-ready, temporary provider failure, authorization failure and interrupted evaluation. Ensure mobile evaluation status appears beneath the title and the composer stays compact at 390px.

- [ ] **Step 5: Update project documentation**

Document the new architecture, development auth mode, per-client deployment model, corpus lifecycle, conversation persistence, evaluation history and verification commands. Keep secret values out of examples.

- [ ] **Step 6: Run the design blacklist sweep**

Run:

```bash
rg -n "gradient|backdrop-blur|blur-|indigo|violet|purple|fuchsia|marquee|✨|🤖" src/components src/app/globals.css
```

Expected: no unjustified design-blacklist hits.

- [ ] **Step 7: Run full verification**

Run:

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Expected: every command exits zero with no test failures.

- [ ] **Step 8: Run desktop and mobile visual verification**

Start `npm run dev`, inspect Chat, Sources, Knowledge base and Evaluations at 1440x1000 and 390x844. Verify keyboard focus, long content, empty, loading, error, disabled and active states.

- [ ] **Step 9: Commit**

```bash
git add convex src README.md AGENTS.md
git commit -m "chore: complete B2B copilot hardening"
```

---

### Task 8: Review, publish and merge

**Files:**
- Review all changes from `git merge-base main HEAD` to `HEAD`.

**Interfaces:**
- No new product behavior. This task proves the branch meets the specification and safely integrates it.

- [ ] **Step 1: Run final whole-branch code review**

Use the most capable available reviewer for architecture, security, data integrity, accessibility and specification coverage. Fix all confirmed critical and high findings, plus important findings that affect correctness.

- [ ] **Step 2: Re-run full verification after review fixes**

Run: `npx tsc --noEmit && npm run lint && npm test && npm run build`

Expected: exit zero.

- [ ] **Step 3: Push and create the PR**

Push `codex/nura-premium-b2b-design`. Create a PR summarizing product changes, schema changes, security boundaries, verification evidence and screenshots.

- [ ] **Step 4: Review PR checks and comments**

Wait for GitHub checks and enabled review plugins. Resolve confirmed findings without force-pushing or skipping hooks.

- [ ] **Step 5: Merge to main**

Merge only after checks and required reviews are green. Pull or switch to the updated local `main` without rewriting history.

- [ ] **Step 6: Open the merged application locally**

Run `npm run dev`, open `http://localhost:3000` in the in-app browser and leave the deliverable tab open for the user.
