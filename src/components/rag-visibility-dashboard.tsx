"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

import type { DocumentChunk, KnowledgeDocument } from "@/lib/rag/types";
import type { GroundedAnswerResponse } from "@/lib/rag/grounded-answer";
import type { EmbeddingStorageStatus } from "@/lib/rag/storage-records";
import { MANUAL_EVAL_SET } from "@/lib/eval/manual-eval-set";
import type {
  EvalCaseResult,
  EvalRunResult,
} from "@/lib/eval/manual-eval-set";
import { runEvalsAction } from "@/app/eval-actions";
import {
  buildEvidenceItems as buildChatEvidenceItems,
  ChatWorkspace,
  filterCitedEvidence as filterChatCitedEvidence,
} from "@/components/chat/chat-workspace";
import {
  EvidenceChunkDialog,
  EvidenceInspector,
  type EvidenceItem,
} from "@/components/chat/evidence-inspector";
import { Dialog } from "@/components/ui/dialog";
import { StatusLabel } from "@/components/ui/status-label";
import {
  WorkspaceShell,
  type WorkspaceView,
} from "@/components/workspace/workspace-shell";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import {
  CheckIcon,
  CloseIcon,
  LayersIcon,
  PlusIcon,
  SourceIcon,
  UploadIcon,
} from "@/components/icons";
import { DEFAULT_NURA_CONFIG } from "@/lib/nura-config";
import {
  createId,
  deriveConversationTitle,
  loadConversations,
  MAX_CONVERSATIONS,
  saveConversations,
  type ChatTurn,
  type Conversation,
} from "@/lib/rag/chat-history";

type AskAction = (input: {
  question: string;
  history: { question: string; answer: string }[];
}) => Promise<GroundedAnswerResponse>;

type RagVisibilityDashboardProps = {
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
  addDocumentAction: (formData: FormData) => Promise<void>;
  embedAction: () => Promise<void>;
  askAction: AskAction;
  embeddingStorageStatus: EmbeddingStorageStatus;
};

export function RagVisibilityDashboard({
  documents,
  chunks,
  addDocumentAction,
  embedAction,
  askAction,
  embeddingStorageStatus,
}: RagVisibilityDashboardProps) {
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<EvidenceItem | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusText, setFocusText] = useState<string | null>(null);

  // Conversation state lives here so the sources panel (a sibling of the chat)
  // can read the active turn's evidence.
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  // Saved conversations (localStorage). Loaded after mount to avoid an SSR
  // mismatch; activeConversationId ties the on-screen transcript to a record.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  // Bumped on New chat / switching chats so an in-flight answer from an
  // abandoned conversation is dropped instead of landing in the current one.
  const conversationRef = useRef(0);
  const turnSeq = useRef(0);

  useEffect(() => {
    // One-time client hydration of persisted history. Reading localStorage
    // during render would cause an SSR/client mismatch, so it happens here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations(loadConversations());
  }, []);

  const retrievalReady = embeddingStorageStatus.embeddedChunks > 0;

  const activeAnswer = useMemo(
    () => turns.find((turn) => turn.id === activeTurnId)?.answer ?? null,
    [turns, activeTurnId],
  );
  const retrievedItems = useMemo(
    () => buildChatEvidenceItems(activeAnswer),
    [activeAnswer],
  );
  const citedItems = useMemo(
    () => filterChatCitedEvidence(activeAnswer, retrievedItems),
    [activeAnswer, retrievedItems],
  );

  // Save (or update) the active conversation to localStorage after each turn.
  function persistConversation(nextTurns: ChatTurn[]) {
    const id = activeConversationId ?? createId();
    if (!activeConversationId) {
      setActiveConversationId(id);
    }
    const title = deriveConversationTitle(nextTurns[0]?.question ?? "");
    setConversations((current) => {
      const existing = current.find((conversation) => conversation.id === id);
      const updated: Conversation = {
        id,
        title,
        turns: nextTurns,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      const next = [
        updated,
        ...current.filter((conversation) => conversation.id !== id),
      ].slice(0, MAX_CONVERSATIONS);
      saveConversations(next);
      return next;
    });
  }

  async function submitQuestion(rawValue: string) {
    const question = rawValue.trim();
    if (!question || pendingQuestion) {
      return;
    }

    const guardToken = conversationRef.current;
    const priorTurns = turns;
    const history = priorTurns
      .filter((turn) => turn.answer)
      .map((turn) => ({ question: turn.question, answer: turn.answer!.answer }));

    setPendingQuestion(question);
    try {
      const answer = await askAction({ question, history });
      if (conversationRef.current !== guardToken) {
        return;
      }
      turnSeq.current += 1;
      const nextTurns = [
        ...priorTurns,
        { id: `turn_${turnSeq.current}`, question, answer, error: null },
      ];
      setTurns(nextTurns);
      persistConversation(nextTurns);
    } catch (error) {
      if (conversationRef.current !== guardToken) {
        return;
      }
      turnSeq.current += 1;
      const nextTurns = [
        ...priorTurns,
        {
          id: `turn_${turnSeq.current}`,
          question,
          answer: null,
          error:
            error instanceof Error
              ? error.message
              : "Could not generate an answer.",
        },
      ];
      setTurns(nextTurns);
      persistConversation(nextTurns);
    } finally {
      if (conversationRef.current === guardToken) {
        setPendingQuestion(null);
      }
    }
  }

  function startNewChat() {
    conversationRef.current += 1;
    setTurns([]);
    setPendingQuestion(null);
    setActiveTurnId(null);
    setActiveConversationId(null);
    setSourcesOpen(false);
    setFocusId(null);
    setFocusText(null);
    setSelectedChunk(null);
  }

  function selectConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    if (!conversation) {
      return;
    }
    conversationRef.current += 1;
    setTurns(conversation.turns);
    setActiveConversationId(id);
    setPendingQuestion(null);
    setActiveTurnId(null);
    setSourcesOpen(false);
    setFocusId(null);
    setFocusText(null);
    setSelectedChunk(null);
  }

  function deleteConversation(id: string) {
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== id);
      saveConversations(next);
      return next;
    });
    if (id === activeConversationId) {
      conversationRef.current += 1;
      setTurns([]);
      setActiveConversationId(null);
      setPendingQuestion(null);
      setActiveTurnId(null);
      setSourcesOpen(false);
      setFocusId(null);
      setFocusText(null);
    }
  }

  function openSources(turnId: string) {
    if (turnId !== activeTurnId) {
      setFocusId(null);
      setFocusText(null);
    }
    setActiveTurnId(turnId);
    setSourcesOpen(true);
  }

  function focusEvidence(
    turnId: string,
    id: string,
    matchedSentence: string,
  ) {
    setActiveTurnId(turnId);
    setSourcesOpen(true);
    setFocusId(id);
    setFocusText(matchedSentence);
    setFocusToken((token) => token + 1);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      // A dialog owns Escape while it is open; let it close only itself so the
      // sources panel behind it does not collapse at the same time.
      if (selectedChunk) {
        return;
      }
      setSourcesOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedChunk]);

  function selectWorkspaceView(view: WorkspaceView) {
    setActiveView(view);
    setSourcesOpen(false);
  }

  return (
    <WorkspaceShell
      activeView={activeView}
      inspector={
        activeView === "chat" && sourcesOpen ? (
          <>
            <button
              aria-label="Close sources"
              className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
              onClick={() => setSourcesOpen(false)}
              type="button"
            />
            <EvidenceInspector
              citedItems={citedItems}
              focusId={focusId}
              focusText={focusText}
              focusToken={focusToken}
              onClose={() => setSourcesOpen(false)}
              onOpenChunk={setSelectedChunk}
              retrievedItems={retrievedItems}
            />
          </>
        ) : undefined
      }
      navigation={
        <WorkspaceNav
          activeConversationId={activeConversationId}
          activeView={activeView}
          conversations={conversations}
          documentsCount={documents.length}
          embeddedChunks={embeddingStorageStatus.embeddedChunks}
          onDeleteConversation={deleteConversation}
          onSelectConversation={selectConversation}
          onSelectView={selectWorkspaceView}
          retrievalReady={retrievalReady}
        />
      }
      onSelectView={selectWorkspaceView}
    >
      {activeView === "chat" ? (
        <ChatWorkspace
          askDisabled={!retrievalReady}
          canReset={turns.length > 0 || pendingQuestion !== null}
          focusedEvidenceId={focusId}
          onFocusEvidence={focusEvidence}
          onNewChat={startNewChat}
          onOpenSources={openSources}
          onSubmit={submitQuestion}
          pendingQuestion={pendingQuestion}
          ready={retrievalReady}
          turns={turns}
        />
      ) : (
        <ScrollView>
          {activeView === "knowledge" ? (
            <KnowledgeView
              addDocumentAction={addDocumentAction}
              chunks={chunks}
              documents={documents}
              embedAction={embedAction}
              retrievalReady={retrievalReady}
            />
          ) : null}
          {activeView === "evaluations" ? <EvaluationsView /> : null}
        </ScrollView>
      )}

      {selectedChunk ? (
        <EvidenceChunkDialog
          focusText={focusText}
          item={selectedChunk}
          onClose={() => setSelectedChunk(null)}
        />
      ) : null}
    </WorkspaceShell>
  );
}

function ScrollView({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="panel-in mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Knowledge base
 * ------------------------------------------------------------------ */

function KnowledgeView({
  addDocumentAction,
  chunks,
  documents,
  embedAction,
  retrievalReady,
}: {
  addDocumentAction: (formData: FormData) => Promise<void>;
  chunks: DocumentChunk[];
  documents: KnowledgeDocument[];
  embedAction: () => Promise<void>;
  retrievalReady: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">
            {DEFAULT_NURA_CONFIG.knowledgeLabel}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            The synthetic documents and the chunks they split into.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-secondary h-10 px-3.5 text-sm"
            onClick={() => setAddOpen(true)}
            type="button"
          >
            <PlusIcon className="size-4" />
            Add document
          </button>
          <ReembedButton embedAction={embedAction} retrievalReady={retrievalReady} />
        </div>
      </div>

      <section>
        <SectionHeading count={`${documents.length} documents`} title="Source documents" />
        {documents.length === 0 ? (
          <EmptyState message="No synthetic documents found. Add one to get started." />
        ) : (
          <CollapsibleList
            initial={4}
            itemsLabel="documents"
            total={documents.length}
          >
            {(limit) => (
              <div className="grid gap-3 sm:grid-cols-2">
                {documents.slice(0, limit).map((document) => (
                  <article className="card p-4" key={document.source}>
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-deep">
                        <SourceIcon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-ink">
                          {document.title}
                        </h3>
                        <p className="truncate font-mono text-xs text-ink-muted">
                          {document.source}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-4 flex gap-5">
                      <InlineStat
                        label="Sections"
                        value={countSections(document.text).toString()}
                      />
                      <InlineStat
                        label="Words"
                        value={countWords(document.text).toLocaleString("en-US")}
                      />
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </CollapsibleList>
        )}
      </section>

      <section>
        <SectionHeading count={`${chunks.length} chunks`} title="Chunk preview" />
        {chunks.length === 0 ? (
          <EmptyState message="No chunks generated yet." />
        ) : (
          <CollapsibleList initial={3} itemsLabel="chunks" total={chunks.length}>
            {(limit) => (
              <div className="flex flex-col gap-2.5">
                {chunks.slice(0, limit).map((chunk) => (
                  <article className="card p-4" key={chunk.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-accent-deep">
                        {chunk.id}
                      </span>
                      <span className="tnum font-mono text-xs text-ink-faint">
                        ~{chunk.tokenEstimate} tokens
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <MetaTag>{chunk.source}</MetaTag>
                      <MetaTag>{chunk.section}</MetaTag>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-ink-muted">{chunk.text}</p>
                  </article>
                ))}
              </div>
            )}
          </CollapsibleList>
        )}
      </section>

      {addOpen ? (
        <AddDocumentDialog
          action={addDocumentAction}
          onClose={() => setAddOpen(false)}
        />
      ) : null}
    </div>
  );
}

// Client-side embed trigger: calls the server action in a transition so a
// failure surfaces inline (and preserves the current view) instead of becoming
// an unhandled rejection or a sticky error query param.
function ReembedButton({
  embedAction,
  retrievalReady,
}: {
  embedAction: () => Promise<void>;
  retrievalReady: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await embedAction();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Embedding failed.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="btn btn-primary h-10 px-3.5 text-sm"
        disabled={pending}
        onClick={handleClick}
        type="button"
      >
        {pending ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        ) : (
          <LayersIcon className="size-4" />
        )}
        {retrievalReady ? "Re-embed corpus" : "Store and embed chunks"}
      </button>
      {error ? (
        <p className="max-w-xs text-right text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CollapsibleList({
  children,
  initial,
  itemsLabel,
  total,
}: {
  children: (limit: number) => ReactNode;
  initial: number;
  itemsLabel: string;
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? total : initial;
  const remaining = total - initial;

  return (
    <div className="mt-4">
      {children(limit)}
      {total > initial ? (
        <button
          className="btn btn-secondary mt-3 h-9 w-full text-sm"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? "Show less" : `Load ${remaining} more ${itemsLabel}`}
        </button>
      ) : null}
    </div>
  );
}

function AddDocumentDialog({
  action,
  onClose,
}: {
  action: (formData: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handle(formData: FormData) {
    setError(null);
    const file = formData.get("file");
    const hasFile = file instanceof File && file.size > 0;
    const title = String(formData.get("title") ?? "").trim();
    const body = String(formData.get("body") ?? "").trim();

    if (!hasFile && (!title || !body)) {
      setError("Upload a file, or enter a title and document text.");
      return;
    }

    try {
      await action(formData);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add the document.",
      );
    }
  }

  return (
    <Dialog ariaLabel="Add document" maxWidth="max-w-lg" onClose={onClose}>
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Add a synthetic document</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Upload a Markdown, text or PDF file, or paste text with{" "}
            <code className="font-mono">## Heading</code> lines.
          </p>
        </div>
        <button
          aria-label="Close"
          className="icon-btn size-8 shrink-0"
          onClick={onClose}
          type="button"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      <form action={handle} className="flex flex-col gap-4 px-5 py-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-canvas px-4 py-6 text-center transition hover:border-accent hover:bg-accent-soft">
          <input
            accept=".md,.markdown,.txt,.pdf"
            className="sr-only"
            name="file"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
            type="file"
          />
          <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent-deep">
            <UploadIcon className="size-5" />
          </span>
          <span className="break-words text-sm font-medium text-ink">
            {fileName ?? "Click to upload a file"}
          </span>
          <span className="text-xs text-ink-faint">
            Markdown, text or PDF, up to 5 MB
          </span>
        </label>

        <div className="flex items-center gap-3 text-xs font-medium text-ink-faint">
          <span className="h-px flex-1 bg-border" />
          or paste manually
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink-muted" htmlFor="doc-title">
            Title
          </label>
          <input
            className="field-input px-3 py-2.5 text-sm text-ink outline-none"
            id="doc-title"
            name="title"
            placeholder="Warranty policy"
            type="text"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink-muted" htmlFor="doc-body">
            Document text
          </label>
          <textarea
            className="field-input min-h-40 resize-y px-3 py-2.5 text-sm leading-6 text-ink outline-none"
            id="doc-body"
            name="body"
            placeholder={"## Coverage\nProducts are covered for 12 months.\n\n## Exclusions\nMisuse is not covered."}
          />
        </div>
        {error ? (
          <p className="text-[13px] font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            className="btn btn-secondary h-10 px-4 text-sm"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <AddDocumentSubmit />
        </div>
      </form>
    </Dialog>
  );
}

function AddDocumentSubmit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary h-10 px-4 text-sm" disabled={pending} type="submit">
      {pending ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      ) : (
        <PlusIcon className="size-4" />
      )}
      Add document
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Evaluations
 * ------------------------------------------------------------------ */

function EvaluationsView() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<EvalRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resultsById = useMemo(() => {
    const map = new Map<string, EvalCaseResult>();
    for (const item of result?.results ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [result]);

  function runEvals() {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await runEvalsAction());
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The eval run failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">
            {DEFAULT_NURA_CONFIG.evaluationsLabel}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">
            {MANUAL_EVAL_SET.length} checks that run the real RAG loop and grade each
            answer against the behavior it has to get right.
          </p>
        </div>
        <button
          className="btn btn-primary h-10 shrink-0 px-3.5 text-sm"
          disabled={pending}
          onClick={runEvals}
          type="button"
        >
          {pending ? (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          ) : (
            <CheckIcon className="size-4" />
          )}
          {pending ? "Running" : result ? "Run again" : "Run evals"}
        </button>
      </div>

      {pending ? (
        <p className="text-sm text-ink-muted" role="status">
          Running {MANUAL_EVAL_SET.length} checks against the model. This calls the
          answer model once per question and can take up to a minute.
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <EvalSummary result={result} />
      ) : (
        <p className="text-sm text-ink-faint">
          No run yet. Each check runs live, so results reflect the current corpus and
          model, not a canned pass.
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {MANUAL_EVAL_SET.map((item) => (
          <EvalRow key={item.id} item={item} outcome={resultsById.get(item.id)} />
        ))}
      </div>
    </div>
  );
}

function EvalSummary({ result }: { result: EvalRunResult }) {
  const allPassed = result.passed === result.total;
  return (
    <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-baseline gap-2">
        <span
          className={[
            "tnum text-2xl font-semibold",
            allPassed ? "text-success" : "text-ink",
          ].join(" ")}
        >
          {result.passed}/{result.total}
        </span>
        <span className="text-sm text-ink-muted">checks passed</span>
      </div>
      <StatusLabel tone={allPassed ? "success" : "warning"}>
        {allPassed ? "All passing" : `${result.total - result.passed} failing`}
      </StatusLabel>
    </div>
  );
}

function EvalRow({
  item,
  outcome,
}: {
  item: (typeof MANUAL_EVAL_SET)[number];
  outcome: EvalCaseResult | undefined;
}) {
  return (
    <article className="card flex items-start gap-4 p-4">
      <EvalStatusIcon status={outcome?.status} />
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-sm font-semibold text-ink">{item.question}</h3>
        <p className="mt-1 text-sm leading-6 text-ink-muted">{item.expectation}</p>
        {outcome ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <p className="break-words text-xs text-ink-faint">{outcome.detail}</p>
            {outcome.citedSources.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {outcome.citedSources.map((source) => (
                  <MetaTag key={source}>{source}</MetaTag>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <StatusLabel tone={item.category === "Guardrail" ? "warning" : "neutral"}>
        {item.category}
      </StatusLabel>
    </article>
  );
}

function EvalStatusIcon({ status }: { status?: "pass" | "fail" }) {
  if (status === "pass") {
    return (
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
        <CheckIcon className="size-4" />
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger">
        <CloseIcon className="size-4" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-sunken text-ink-faint">
      <span className="size-1.5 rounded-full bg-current" />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

function SectionHeading({ title, count }: { title: string; count: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <span className="tnum text-xs font-medium text-ink-faint">{count}</span>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-canvas px-3 py-2.5">
      <dt className="text-[11px] font-medium text-ink-faint">{label}</dt>
      <dd className="tnum mt-1 truncate text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-ink-faint">{label}</dt>
      <dd className="tnum mt-0.5 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

function MetaTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-border bg-canvas px-2 py-0.5 font-mono text-[11px] text-ink-muted">
      {children}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-border-strong bg-surface p-6 text-sm text-ink-muted">
      {message}
    </div>
  );
}

function countSections(markdown: string) {
  return markdown.split(/\r?\n/).filter((line) => line.startsWith("## ")).length;
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
