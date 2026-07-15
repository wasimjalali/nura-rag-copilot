# Nura Premium B2B RAG Copilot Design

Date: 2026-07-15

Status: Approved direction, pending final written-spec review

## 1. Purpose

Nura is a grounded support copilot that exposes the complete retrieval-augmented generation loop. This design upgrades the existing application in two coordinated ways:

1. A premium visual and interaction pass that makes the workspace feel deliberate, efficient and trustworthy.
2. Product and backend hardening that makes the codebase a reliable foundation for separate B2B client deployments.

Nura is not being designed as a public consumer SaaS platform. Each business deployment can be customized for that client's documents, policies, identity provider, workflows and visual brand. Shared billing, public signup, self-service organizations and generalized marketplace features are outside this design.

## 2. Product definition

- Product: Nura RAG Copilot.
- Primary users: support agents who need fast, grounded answers during customer conversations.
- Secondary users: knowledge managers who maintain the corpus and operators who monitor retrieval quality.
- Product type: internal B2B operational tool.
- Primary job: answer a support question from approved evidence and make the answer's provenance immediately inspectable.
- Secondary jobs: manage the approved corpus, diagnose retrieval behavior and monitor quality through evaluations.

## 3. Goals

### 3.1 Experience goals

- Make the chat workspace feel calm, fast and professional during repeated daily use.
- Make evidence inspection the strongest and most memorable interaction in the product.
- Reduce empty space without creating a dense or noisy interface.
- Give every important action a clear state: idle, loading, success, empty, error, disabled and retryable.
- Treat mobile as a deliberate re-layout rather than a compressed desktop screen.
- Preserve the existing role-named design-token approach and one-accent visual language.

### 3.2 Product goals

- Turn Knowledge base from a preview page into an operational document-management workspace.
- Turn Evaluations from a temporary live checklist into a quality history and diagnostic surface.
- Persist conversations and evaluation runs in the backend for a real deployed workspace.
- Keep the core RAG loop framework-free and visible.
- Make client customization straightforward without introducing a generic multi-tenant SaaS architecture.

### 3.3 Reliability goals

- Prevent failed ingestion or embedding runs from damaging the active corpus.
- Avoid re-embedding unchanged chunks.
- Add bounded provider resilience, rate controls and safe public error messages.
- Record enough retrieval and generation telemetry to diagnose failures and quality regressions.
- Extend citation validation from label validity toward claim-to-evidence quality measurement.

## 4. Non-goals

- Public signup, subscriptions, billing or usage-based customer invoicing.
- A shared multi-company control plane.
- Runtime tenant switching inside one deployment.
- LangChain, LangGraph, CrewAI or another RAG framework.
- Autonomous agents, GraphRAG, hybrid retrieval, reranking or fine-tuning.
- Real customer data in the reference implementation.
- A marketing site or consumer onboarding funnel.
- Dark mode in this enhancement.
- A generalized plugin marketplace or third-party integration catalog.

## 5. Product principles

1. Evidence before decoration. The source relationship gets visual emphasis. Decorative effects do not.
2. One primary action per view. Chat asks a question, Knowledge base adds or indexes documents and Evaluations runs checks.
3. Operational density is intentional. Tables and compact inspector panels are preferred when users compare repeated records.
4. Progressive disclosure keeps the default view simple while preserving technical depth.
5. Failure states explain what happened, what remains safe and what the user can do next.
6. Client customization happens through explicit configuration boundaries, not scattered conditional styling or copied logic.
7. The active corpus is immutable from the answering path. New corpus versions become active only after successful validation.

## 6. Visual direction

### 6.1 Palette

The existing cool-neutral and blue identity remains. The implementation may refine contrast and role definitions, but it will not introduce a second accent.

- Canvas: `#F3F6FA`, low-contrast application background.
- Surface: `#FFFFFF`, primary working surface.
- Ink: `#0E1B2B`, primary content.
- Ink muted: `#566372`, secondary explanation.
- Brand: `#102A43`, logo and anchored structural elements.
- Accent: `#2F6FED`, primary actions, active navigation and provenance focus.

Semantic success, warning and danger colors appear only for genuine states. No gradients, glass effects, glows, decorative textures or purple family colors are introduced.

### 6.2 Typography

- Inter remains the body and interface typeface because the product is an operational workspace with dense support text, not a brand-led editorial surface. The used weights remain deliberately limited to 400, 500, 600 and 700.
- JetBrains Mono remains the data typeface for chunk IDs, scores, ranks, timestamps and model metadata.
- Headings use tighter spacing and restrained weight. Body text keeps comfortable line height for long support answers.
- Numeric metrics use tabular figures and consistent precision.

### 6.3 Separation and elevation

Hairline borders and background shifts are the primary separation mechanism. Shadows are limited to true elevation such as dialogs, the sticky composer and temporary overlays. Repeated content should not become a field of floating cards.

### 6.4 Signature interaction

Nura's signature is the provenance trace.

When a user focuses a citation, the answer paragraph and supporting chunk become visually linked. The evidence inspector scrolls to the exact chunk, highlights the supporting passage and keeps rank, score, source, section and chunk ID visible. The interaction must remain useful without motion and must respect reduced-motion preferences.

The default answer remains readable without opening the inspector. Provenance adds depth without interrupting the main task.

## 7. Information architecture

The stable navigation keeps three top-level workspaces:

1. Chat
2. Knowledge base
3. Evaluations

Recent conversations remain under Chat context in the left rail. Workspace status remains anchored at the bottom of the rail, but it becomes a compact system-health summary rather than a decorative statistic block.

Desktop uses a stable left rail, primary workspace and optional right inspector. At wide widths, the shell reserves space for the inspector so opening it does not change existing answer line breaks. At medium widths, the inspector overlays the workspace. Mobile uses a top bar, modal navigation drawer and bottom-sheet or full-height evidence inspector depending on available height.

## 8. Chat workspace

### 8.1 Desktop layout

- Stable left navigation rail.
- Center conversation column with a readable maximum line length.
- Sticky composer attached to the bottom of the working area.
- Optional right evidence inspector that does not obscure the answer.
- Compact header with conversation title, new-chat action and contextual answer controls.

The empty state becomes more task-oriented. It keeps example questions but aligns them to common support intents such as policy, shipping, subscriptions and escalation. The layout remains left-aligned on small screens and avoids excessive vertical centering.

### 8.2 Conversation turns

Each assistant turn includes:

- Grounded answer paragraphs.
- Inline citation controls.
- A compact source count.
- Copy answer.
- Retry answer.
- Helpful or not helpful feedback.
- Optional details disclosure for latency, model, retrieval count and answer status.

The details are secondary and collapsed by default. They must not make the support response read like a developer console.

### 8.3 Generation states

The existing honest loading message remains conceptually correct. The enhanced design adds:

- A visible distinction between retrieval failure and generation failure.
- Retry that keeps the original question and conversation context.
- A non-destructive notice when the user navigates away from an active request.

Fake token streaming or fake progress stages are not added. The initial enhancement does not show a cancel control because the current action path cannot guarantee end-to-end cancellation. Cancellation or real response streaming may be introduced later only when the provider and Convex path support them cleanly and citation validation still happens before the answer is marked complete.

### 8.4 Conversation history

Conversation history moves from local-only storage to Convex. Each conversation has an owner, title, timestamps and ordered turns. Assistant messages store the corpus version, model identifiers, answer status and the evidence snapshot used for that turn. A client deployment may use a simple development identity when enterprise identity integration is not yet configured.

Conversation context is loaded on the server from the authorized conversation. The answer action does not trust arbitrary prior assistant answers submitted by the browser. A client-generated request ID makes retries idempotent and prevents duplicate turns.

History supports:

- Rename.
- Delete with undo where practical.
- Search by title and question text.
- Clear active conversation.
- Retention configuration at deployment level.

## 9. Evidence inspector

The inspector has two explicit views:

- Cited: chunks referenced by the final answer.
- Retrieved: all chunks returned by retrieval, including chunks not cited.

Each chunk displays source, section, score, rank, chunk ID and a readable excerpt. The full-chunk view remains available. Score language avoids implying a calibrated probability. The interface labels it as similarity score and provides a short explanation through progressive disclosure.

The provenance trace links a citation to the exact evidence card. The default behavior focuses the full chunk. A supporting sentence is highlighted only when a deterministic normalized-substring match succeeds. Otherwise, the interface does not invent a precise supporting span.

Citation controls expose `aria-expanded` and `aria-controls`, plus a descriptive accessible name containing the source and section. Keyboard order moves from citation to evidence card to full chunk and back to the originating citation when the inspector closes. Retrieval readiness always uses text and iconography in addition to color.

## 10. Knowledge base workspace

### 10.1 Default view

The document grid becomes an operational table on desktop and stacked rows on mobile. It includes:

- Document title and source.
- Status: active, processing, needs indexing or failed.
- Section and chunk counts.
- Last indexed time.
- Active corpus version.
- Row actions.

Search, status filters and sort controls appear above the table. The primary action is Add document.

### 10.2 Document detail

Selecting a document opens a detail view or inspector containing:

- Metadata and current status.
- Extracted sections.
- Generated chunks.
- Embedding state.
- Last successful processing run.
- Safe retry for failed processing.
- Removal from the next corpus version.

The reference implementation continues to use synthetic data. Delete actions must verify references and use confirmation only when undo is not practical.

### 10.3 Ingestion workflow

Upload and paste remain supported. The workflow becomes staged:

1. Validate file type and limits.
2. Extract text.
3. Preview document title and section structure.
4. Confirm addition.
5. Create a draft corpus version.
6. Chunk and embed only changed content.
7. Validate counts and dimensions.
8. Activate the complete version atomically.

The current active corpus remains available throughout processing. A failed run leaves the previous version untouched.

## 11. Evaluations workspace

### 11.1 Evaluation runs

Evaluation runs are persisted with:

- Run ID and timestamp.
- Corpus version.
- Prompt version.
- Answer and embedding model identifiers.
- Total, passed and failed counts.
- Duration.
- Per-case result and diagnostics.

Operators can run evaluations against the active corpus or a ready draft. A draft may show whether it meets configured quality thresholds, but activation still requires an explicit authorized decision.

### 11.2 Default view

The page begins with a compact latest-run summary and a small history trend. The case list supports category and status filters. On mobile, status moves beneath the case heading instead of competing for the narrow first row.

### 11.3 Quality dimensions

The existing deterministic cases remain. The design adds measurement for:

- Correct refusal behavior.
- Expected source retrieval.
- Citation presence.
- Citation label validity.
- Retrieval latency and generation latency.
- Claim-to-evidence entailment as an evaluation signal.

Entailment checking is an evaluation and monitoring layer, not a reason to hide the deterministic validation already present. It must not silently rewrite answers.

## 12. Frontend architecture

The 1,997-line dashboard is split by feature ownership. The intended boundaries are:

```text
src/components/workspace/
  workspace-shell.tsx
  workspace-nav.tsx
  mobile-navigation.tsx

src/components/chat/
  chat-workspace.tsx
  chat-header.tsx
  conversation-list.tsx
  conversation-turn.tsx
  answer-message.tsx
  chat-composer.tsx
  evidence-inspector.tsx
  evidence-card.tsx

src/components/knowledge/
  knowledge-workspace.tsx
  document-table.tsx
  document-detail.tsx
  add-document-dialog.tsx
  ingestion-status.tsx

src/components/evaluations/
  evaluations-workspace.tsx
  evaluation-summary.tsx
  evaluation-history.tsx
  evaluation-case-row.tsx

src/components/ui/
  button.tsx
  dialog.tsx
  status-label.tsx
  empty-state.tsx
  skeleton.tsx
```

Feature components own feature behavior. Shared UI primitives own interaction mechanics and styling contracts. The split must preserve existing public behavior and avoid speculative abstraction.

State with server value moves to Convex queries and mutations. Temporary interaction state, such as an open dialog or active inspector tab, remains local.

## 13. Backend architecture

### 13.1 Deployment boundary

Each client receives a separate application deployment, Convex deployment and model credential set. The reference architecture does not add generalized tenant columns, runtime tenant switching or a cross-company control plane. A singleton deployment configuration may hold the client name, terminology, retention policy and feature settings.

Authentication is adapter-based at the application boundary so a deployment can use the client's chosen enterprise identity provider with no public signup. Every public Convex function calls a shared identity and role guard. Protecting only the Next.js server actions is not sufficient because Convex functions can otherwise be called directly. Authorization distinguishes at minimum:

- Support agent: ask questions and access permitted conversation history.
- Knowledge manager: manage documents and indexing.
- Operator: run evaluations and inspect operational diagnostics.

The reference project can provide a simple development identity, but production mutations must never remain anonymously callable.

### 13.2 Corpus versioning

Documents, chunks and embedding runs belong to a corpus version. One version is active. New versions are built in a draft or processing state. Activation occurs only after all required chunks have valid embeddings and the run passes integrity checks.

Retrieval always filters to the active corpus version. Failed draft versions remain diagnosable and can be retried or discarded without changing active retrieval.

Recent inactive versions are retained for operator-controlled rollback. Promotion of a ready draft remains an explicit knowledge-manager or operator action rather than an automatic side effect of embedding completion.

Schema changes require an explicit approval checkpoint immediately before implementation, following the project rules.

### 13.3 Incremental embeddings

A stable key containing the text hash, chunker version, embedding model and embedding dimensions determines whether a vector can be reused. Unchanged chunks reuse compatible embeddings. New or changed chunks are embedded. Removed chunks disappear only from the new version.

Embedding reuse requires the same embedding model and dimensions. A model or dimension change forces a controlled full rebuild.

Each embedding write verifies the run ID, corpus-version status and expected content hash. A stale run cannot overwrite a newer draft. Large jobs checkpoint completed batches so transient failures do not restart completed work.

### 13.4 Provider resilience

Provider calls add:

- A maximum of three attempts for network errors, timeouts, HTTP 408, HTTP 429 and HTTP 5xx responses.
- Exponential backoff with jitter.
- Respect for `Retry-After` when the provider returns it.
- Explicit request timeouts.
- Concurrency limits for ingestion and evaluations.
- Per-user and deployment-wide request limits suitable for the client environment.
- Idempotency around ingestion runs where the platform supports it.

Retries never apply to authentication, configuration, validation or malformed-request errors.

### 13.5 Safe errors

Client-facing errors use stable codes such as `AUTH_REQUIRED`, `FORBIDDEN`, `RATE_LIMITED`, `CORPUS_NOT_READY`, `PROVIDER_TEMPORARY` and `INVALID_MODEL_RESPONSE`. Detailed provider responses, stack traces and internal identifiers stay in server logs. The UI maps errors to recovery actions such as retry, reopen Knowledge base or contact the deployment operator. Insufficient evidence remains a successful answer state, not an operational error.

The local synthetic-document filesystem remains valid for development. A production client deployment stores uploaded source files in durable private storage associated with a draft corpus version.

## 14. Observability

Each answer request records a correlation ID and structured operational fields:

- Workspace and corpus version.
- Conversation and turn ID.
- Retrieval count and score distribution.
- Retrieval latency.
- Generation latency.
- Answer type.
- Cited chunk count.
- Model identifiers.
- Token usage when returned by the provider.
- Estimated model cost when configuration provides pricing.
- Safe error code.

Embedding runs record documents examined, chunks reused, chunks embedded, failures, duration and activated version. Evaluation runs link to the corpus and model configuration used.

The initial implementation may store operational records in Convex and emit structured server logs. A client-specific telemetry exporter can be added later without changing core RAG behavior.

Logs never contain credentials, complete prompts or full document text.

## 15. Data flow

### 15.1 Answer flow

1. Authenticate the user and authorize question access.
2. Validate and normalize the question.
3. Load bounded server-owned conversation context.
4. Embed the retrieval query.
5. Search only the active corpus version.
6. Apply the relevance floor.
7. Build the grounded prompt with untrusted evidence boundaries.
8. Request structured output.
9. Validate answer type, paragraphs and citation labels, then record claim-support evaluation signals.
10. Persist the turn and operational metrics.
11. Return the answer and evidence to the client.

### 15.2 Ingestion flow

1. Authorize knowledge-management access.
2. Validate and extract the uploaded content.
3. Create a draft document and corpus version.
4. Chunk content and compare hashes against the active version.
5. Reuse compatible embeddings and request only missing vectors.
6. Validate vector count and dimensions.
7. Mark the draft version ready.
8. Await explicit authorized promotion, then activate it atomically.
9. Record the run and refresh the workspace status.

## 16. Error and recovery design

- Retrieval unavailable: keep the question in the composer and offer retry.
- No relevant evidence: return the existing honest insufficient-evidence answer.
- Generation failure: distinguish it from no evidence and allow retry.
- Ingestion extraction failure: keep the active corpus unchanged and show the document-specific reason.
- Embedding failure: preserve the draft version and expose retry or discard.
- Evaluation interruption: persist completed cases and mark the run interrupted.
- Conversation persistence failure: show a non-blocking warning rather than pretending history was saved.
- Authorization failure: hide privileged actions and return a stable forbidden state from the backend.

## 17. Testing strategy

### 17.1 Unit and component tests

- Existing chunking, provider, grounding and evaluation tests remain.
- Feature components receive isolated interaction tests.
- Citation focus, inspector tabs, retry and feedback controls receive keyboard tests.
- Mobile evaluation rows and composer layout receive targeted regression tests.

### 17.2 Integration tests

- Convex tests cover corpus version activation and failed-run rollback behavior.
- Retrieval tests verify active-version filtering.
- Incremental embedding tests verify reuse and forced rebuild rules.
- Authorization tests cover agent, knowledge-manager and operator boundaries.
- Conversation and evaluation persistence tests cover ownership and retention.

### 17.3 Quality and visual verification

- Run `npx tsc --noEmit`, `npm run lint`, `npm test` and `npm run build`.
- Audit 1440px and 390px viewports.
- Verify empty, loading, error, hover, focus, active and disabled states.
- Run automated accessibility checks and manual keyboard journeys.
- Run the design blacklist sweep against changed UI files.
- Run adversarial security and code review before critical backend changes are considered complete.

## 18. Implementation workstreams

The implementation plan should divide the enhancement into reviewable branches or pull requests:

1. Frontend decomposition with behavior preserved.
2. Premium chat and provenance experience.
3. Knowledge base and evaluation workspace redesign.
4. Conversation and evaluation persistence.
5. Versioned corpus and incremental embeddings.
6. Authentication boundary, provider resilience and observability.
7. Final responsive, accessibility and adversarial review pass.

Schema and authentication changes receive explicit approval immediately before their implementation workstream begins.

## 19. Acceptance criteria

The enhancement is complete when:

- Chat, Knowledge base and Evaluations each have a clear operational primary action.
- Desktop and mobile layouts pass the specified viewport audits.
- Answers support copy, retry, feedback and evidence inspection without cluttering the reading experience.
- Cited and retrieved chunks are separately inspectable.
- Conversations and evaluation runs persist in Convex.
- Knowledge managers can search documents and diagnose ingestion status.
- Failed ingestion cannot replace or damage the active corpus.
- Unchanged chunks do not trigger unnecessary embedding calls.
- Production mutations require authenticated authorized access.
- Operational records make latency, failures and corpus versions diagnosable.
- The existing grounding, refusal and prompt-injection protections remain intact.
- TypeScript, lint, tests and production build all pass.
- No critical or high confirmed adversarial-review findings remain.

## 20. Customization model

Per-client customization should use explicit configuration and bounded adapters:

- Brand tokens and logo.
- Client terminology and interface copy.
- Identity-provider adapter.
- Corpus source and ingestion adapter.
- Domain-specific guardrail prompt modules.
- Evaluation case packs.
- Retention and request-limit configuration.
- Optional telemetry exporter.

Core retrieval, grounding, citation validation and corpus-version behavior remain shared. Client projects should not fork those rules unless a documented domain requirement demands it.
