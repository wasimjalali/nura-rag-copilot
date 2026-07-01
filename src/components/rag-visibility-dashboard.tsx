"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";

import type { DocumentChunk, KnowledgeDocument } from "@/lib/rag/types";
import type { GroundedAnswerResponse } from "@/lib/rag/grounded-answer";
import { formatRetrievalScore } from "@/lib/rag/retrieval";
import type { EmbeddingStorageStatus } from "@/lib/rag/storage-records";
import { MANUAL_EVAL_SET } from "@/lib/eval/manual-eval-set";
import type {
  EvalCaseResult,
  EvalRunResult,
} from "@/lib/eval/manual-eval-set";
import { runEvalsAction } from "@/app/eval-actions";
import { NuraLogo, NuraMark } from "@/components/nura-logo";
import {
  ArrowRightIcon,
  ChatIcon,
  CheckIcon,
  CloseIcon,
  EvaluationsIcon,
  KnowledgeIcon,
  LayersIcon,
  PlusIcon,
  QuoteIcon,
  SendIcon,
  SourceIcon,
  UploadIcon,
} from "@/components/icons";

type WorkspaceView = "chat" | "knowledge" | "evaluations";

type RagVisibilityDashboardProps = {
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
  addDocumentAction: (formData: FormData) => Promise<void>;
  embedAction: () => Promise<void>;
  generateAnswerAction: (formData: FormData) => Promise<void>;
  embeddingStorageStatus: EmbeddingStorageStatus;
  groundedAnswer?: GroundedAnswerResponse | null;
  generateAnswerError?: string | null;
  submittedQuestion?: string;
};

type EvidenceItem = {
  id: string;
  label: string;
  labelNumber: string;
  source: string;
  section: string;
  text: string;
  score: number;
  scoreLabel: string;
  rankLabel: string;
  tokenEstimate: number;
};

type NavItem = {
  id: WorkspaceView;
  label: string;
  icon: (props: { className?: string }) => ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { id: "chat", label: "Chat", icon: ChatIcon },
  { id: "knowledge", label: "Knowledge base", icon: KnowledgeIcon },
  { id: "evaluations", label: "Evaluations", icon: EvaluationsIcon },
];

const SAMPLE_QUESTIONS = [
  "Can customers return opened products?",
  "Does express shipping change the order cutoff?",
  "How much can an agent discount without manager approval?",
  "How do I pause a subscription for a month?",
];

export function RagVisibilityDashboard({
  documents,
  chunks,
  addDocumentAction,
  embedAction,
  generateAnswerAction,
  embeddingStorageStatus,
  groundedAnswer = null,
  generateAnswerError = null,
  submittedQuestion = "",
}: RagVisibilityDashboardProps) {
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<EvidenceItem | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);

  const retrievalReady = embeddingStorageStatus.embeddedChunks > 0;

  const retrievedItems = useMemo(
    () => buildEvidenceItems(groundedAnswer),
    [groundedAnswer],
  );
  const citedItems = useMemo(
    () => filterCitedEvidence(groundedAnswer, retrievedItems),
    [groundedAnswer, retrievedItems],
  );

  function openSources() {
    setSourcesOpen(true);
  }

  function focusEvidence(id: string) {
    setSourcesOpen(true);
    setFocusId(id);
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
      setMobileNavOpen(false);
      setSourcesOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedChunk]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas text-ink">
      <NavRail
        activeView={activeView}
        documentsCount={documents.length}
        embeddedChunks={embeddingStorageStatus.embeddedChunks}
        onSelectView={(view) => {
          setActiveView(view);
          setMobileNavOpen(false);
          setSourcesOpen(false);
        }}
        retrievalReady={retrievalReady}
      />

      {mobileNavOpen ? (
        <MobileNavOverlay onClose={() => setMobileNavOpen(false)}>
          <NavRail
            activeView={activeView}
            documentsCount={documents.length}
            embeddedChunks={embeddingStorageStatus.embeddedChunks}
            mobile
            onSelectView={(view) => {
              setActiveView(view);
              setMobileNavOpen(false);
              setSourcesOpen(false);
            }}
            retrievalReady={retrievalReady}
          />
        </MobileNavOverlay>
      ) : null}

      <div className="flex min-w-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar onOpenNav={() => setMobileNavOpen(true)} />

          {activeView === "chat" ? (
            <ChatView
              activeEvidenceId={focusId}
              citedItems={citedItems}
              error={generateAnswerError}
              generateAnswerAction={generateAnswerAction}
              groundedAnswer={groundedAnswer}
              onOpenSources={openSources}
              onFocusEvidence={focusEvidence}
              ready={retrievalReady}
              submittedQuestion={submittedQuestion}
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
        </main>

        {activeView === "chat" && sourcesOpen ? (
          <>
            <button
              aria-label="Close sources"
              className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
              onClick={() => setSourcesOpen(false)}
              type="button"
            />
            <SourcesPanel
              citedItems={citedItems}
              focusId={focusId}
              focusToken={focusToken}
              onClose={() => setSourcesOpen(false)}
              onOpenChunk={setSelectedChunk}
              retrievedCount={retrievedItems.length}
            />
          </>
        ) : null}
      </div>

      {selectedChunk ? (
        <ChunkDialog item={selectedChunk} onClose={() => setSelectedChunk(null)} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shell
 * ------------------------------------------------------------------ */

function NavRail({
  activeView,
  documentsCount,
  embeddedChunks,
  onSelectView,
  retrievalReady,
  mobile = false,
}: {
  activeView: WorkspaceView;
  documentsCount: number;
  embeddedChunks: number;
  onSelectView: (view: WorkspaceView) => void;
  retrievalReady: boolean;
  mobile?: boolean;
}) {
  return (
    <aside
      className={[
        "flex w-[264px] shrink-0 flex-col gap-6 border-r border-border bg-surface px-4 py-5",
        mobile ? "h-full" : "hidden lg:flex",
      ].join(" ")}
    >
      <div className="px-2">
        <NuraLogo />
      </div>

      <nav aria-label="Workspace" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              aria-current={active ? "page" : undefined}
              className="nav-item text-sm"
              key={item.id}
              onClick={() => onSelectView(item.id)}
              type="button"
            >
              <Icon className="size-[18px] shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 px-1">
        <div className="flex items-center gap-2 px-1">
          <span
            className={[
              "size-1.5 rounded-full",
              retrievalReady ? "bg-success" : "bg-warning",
            ].join(" ")}
          />
          <span className="text-xs font-medium text-ink-muted">
            {retrievalReady ? "Retrieval ready" : "Setup needed"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <RailStat label="Documents" value={documentsCount.toString()} />
          <RailStat label="Vectors" value={embeddedChunks.toString()} />
        </div>
        <p className="px-1 text-xs leading-5 text-ink-faint">
          Synthetic support documents only. No customer data.
        </p>
      </div>
    </aside>
  );
}

function RailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-canvas px-3 py-2.5">
      <p className="text-[11px] font-medium text-ink-faint">{label}</p>
      <p className="tnum mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function MobileTopBar({ onOpenNav }: { onOpenNav: () => void }) {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5 lg:hidden">
      <button
        aria-label="Open navigation"
        className="icon-btn size-9"
        onClick={onOpenNav}
        type="button"
      >
        <MenuGlyph />
      </button>
      <NuraLogo compact />
      <span className="text-sm font-semibold text-ink">Nura</span>
    </header>
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

// The mobile nav is modal: it traps Tab and restores focus on close so a
// keyboard or screen-reader user cannot land on the chat hidden behind it.
function MobileNavOverlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Tab" || !panel) {
        return;
      }
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        aria-label="Close navigation"
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
        type="button"
      />
      <div
        aria-label="Navigation"
        aria-modal="true"
        className="panel-in absolute inset-y-0 left-0 w-[264px]"
        ref={panelRef}
        role="dialog"
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Chat
 * ------------------------------------------------------------------ */

function ChatView({
  activeEvidenceId,
  citedItems,
  error,
  generateAnswerAction,
  groundedAnswer,
  onOpenSources,
  onFocusEvidence,
  ready,
  submittedQuestion,
}: {
  activeEvidenceId: string | null;
  citedItems: EvidenceItem[];
  error: string | null;
  generateAnswerAction: (formData: FormData) => Promise<void>;
  groundedAnswer: GroundedAnswerResponse | null;
  onOpenSources: () => void;
  onFocusEvidence: (id: string) => void;
  ready: boolean;
  submittedQuestion: string;
}) {
  const [question, setQuestion] = useState("");
  const [autoSubmitToken, setAutoSubmitToken] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoSubmitToken === 0) {
      return;
    }
    formRef.current?.requestSubmit();
  }, [autoSubmitToken]);

  // Clear the composer when a new question round-trips into an answer, so a
  // follow-up starts from an empty box. This uses React's "adjust state when a
  // prop changes" pattern (not an effect); the form reads the DOM value at
  // submit time, so clearing after the answer returns never truncates the text.
  const [lastSubmitted, setLastSubmitted] = useState(submittedQuestion);
  if (submittedQuestion !== lastSubmitted) {
    setLastSubmitted(submittedQuestion);
    setQuestion("");
  }

  function runQuestion(value: string) {
    setQuestion(value);
    setAutoSubmitToken((token) => token + 1);
  }

  // One form wraps the whole chat so the loading state can be driven by
  // useFormStatus (which resets automatically after the server round-trip),
  // rather than local state that a soft navigation would leave stuck.
  return (
    <form
      action={generateAnswerAction}
      className="flex h-full flex-col"
      ref={formRef}
    >
      <h1 className="sr-only">Support chat</h1>
      <ChatBody
        activeEvidenceId={activeEvidenceId}
        citedItems={citedItems}
        error={error}
        groundedAnswer={groundedAnswer}
        onFocusEvidence={onFocusEvidence}
        onOpenSources={onOpenSources}
        onRunQuestion={runQuestion}
        pendingQuestion={question}
        ready={ready}
        submittedQuestion={submittedQuestion}
      />
      <ComposerBar
        disabled={!ready}
        formRef={formRef}
        onChange={setQuestion}
        textareaRef={textareaRef}
        value={question}
      />
    </form>
  );
}

function ChatBody({
  activeEvidenceId,
  citedItems,
  error,
  groundedAnswer,
  onFocusEvidence,
  onOpenSources,
  onRunQuestion,
  pendingQuestion,
  ready,
  submittedQuestion,
}: {
  activeEvidenceId: string | null;
  citedItems: EvidenceItem[];
  error: string | null;
  groundedAnswer: GroundedAnswerResponse | null;
  onFocusEvidence: (id: string) => void;
  onOpenSources: () => void;
  onRunQuestion: (value: string) => void;
  pendingQuestion: string;
  ready: boolean;
  submittedQuestion: string;
}) {
  const { pending } = useFormStatus();
  const hasConversation = Boolean(submittedQuestion) || Boolean(groundedAnswer);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {!ready ? (
          <SetupNotice />
        ) : pending ? (
          <div className="flex flex-col gap-6">
            {pendingQuestion ? <UserMessage text={pendingQuestion} /> : null}
            <ThinkingIndicator />
          </div>
        ) : !hasConversation ? (
          <ChatWelcome onRunQuestion={onRunQuestion} />
        ) : (
          <div className="flex flex-col gap-6">
            {submittedQuestion ? <UserMessage text={submittedQuestion} /> : null}
            {/* Scope the live region to the assistant reply only, so a screen
                reader announces the answer once instead of the whole column. */}
            <div aria-live="polite">
              {error ? (
                <ErrorMessage message={error} />
              ) : groundedAnswer ? (
                <AnswerMessage
                  activeEvidenceId={activeEvidenceId}
                  citedItems={citedItems}
                  groundedAnswer={groundedAnswer}
                  onFocusEvidence={onFocusEvidence}
                  onOpenSources={onOpenSources}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatWelcome({ onRunQuestion }: { onRunQuestion: (value: string) => void }) {
  return (
    <div className="rise flex flex-col items-center pt-8 text-center sm:pt-16">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand shadow-sm">
        <NuraMark tone="dark" className="size-9" />
      </span>
      <h2 className="mt-5 text-2xl font-semibold tracking-[-0.01em] text-ink">
        Ask a grounded question
      </h2>
      <p className="mt-2 max-w-md text-[15px] leading-6 text-ink-muted">
        Nura answers only from the retrieved support documents and cites every
        source. If the evidence is not there, it says so.
      </p>

      <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
        {SAMPLE_QUESTIONS.map((sample) => (
          <button
            className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-ink transition hover:border-border-strong hover:bg-surface hover:shadow-card"
            key={sample}
            onClick={() => onRunQuestion(sample)}
            type="button"
          >
            <span>{sample}</span>
            <ArrowRightIcon className="size-4 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
          </button>
        ))}
      </div>
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="msg-in flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-6 text-white shadow-sm">
        {text}
      </div>
    </div>
  );
}

function AnswerMessage({
  activeEvidenceId,
  citedItems,
  groundedAnswer,
  onFocusEvidence,
  onOpenSources,
}: {
  activeEvidenceId: string | null;
  citedItems: EvidenceItem[];
  groundedAnswer: GroundedAnswerResponse;
  onFocusEvidence: (id: string) => void;
  onOpenSources: () => void;
}) {
  const grounded = groundedAnswer.structuredAnswer.answerType === "grounded";
  const citedCount = citedItems.length;

  return (
    <div className="msg-in flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand shadow-sm">
        <NuraMark tone="dark" className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">Nura</span>
          {!grounded ? (
            <StatusPill tone="warning">insufficient evidence</StatusPill>
          ) : null}
        </div>

        <div className="flex flex-col gap-3.5 text-[15px] leading-7 text-ink">
          {groundedAnswer.structuredAnswer.paragraphs.map((paragraph, index) => (
            <p className="break-words" key={index}>
              {stripCitationMarkers(paragraph.text)}
              {/* A refusal cites nothing, so we only render the clickable
                  citation chips for a grounded answer. */}
              {grounded
                ? paragraph.citations.map((citation) => {
                    const item = citedItems.find(
                      (evidence) => evidence.label === citation,
                    );
                    if (!item) {
                      return null;
                    }
                    return (
                      <button
                        className="cite ml-1 align-baseline"
                        data-active={
                          item.id === activeEvidenceId ? "true" : undefined
                        }
                        key={`${index}-${citation}`}
                        onClick={() => onFocusEvidence(item.id)}
                        title={`${item.source} · ${item.section}`}
                        type="button"
                      >
                        {citation}
                      </button>
                    );
                  })
                : null}
            </p>
          ))}
        </div>

        {grounded && citedCount > 0 ? (
          <button
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted transition hover:border-accent hover:bg-accent-soft hover:text-accent-deep"
            onClick={onOpenSources}
            type="button"
          >
            <QuoteIcon className="size-3.5" />
            <span>Sources</span>
            <span className="tnum text-accent-deep">{citedCount}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

// A single-shot request has no real streaming progress, so this is an honest
// in-flight indicator rather than a fake multi-step animation. The spinner
// freezes under prefers-reduced-motion, but the text still carries the state.
function ThinkingIndicator() {
  return (
    <div className="msg-in flex gap-3" role="status">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand shadow-sm">
        <NuraMark tone="dark" className="size-5" />
      </span>
      <div className="flex items-center gap-2.5 pt-1.5">
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent"
        />
        <span className="text-sm text-ink-muted">
          Searching the documents and writing a grounded answer…
        </span>
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="rise rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-xl bg-warning-soft text-warning">
        <LayersIcon className="size-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">
        Store and embed chunks before answer generation.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">
        The corpus has not been embedded yet. Open Knowledge base and run the embed
        step, then come back to ask questions.
      </p>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="msg-in flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand shadow-sm">
        <NuraMark tone="dark" className="size-5" />
      </span>
      <div
        className="flex-1 rounded-2xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
        role="alert"
      >
        {message}
      </div>
    </div>
  );
}

function ComposerBar({
  disabled,
  formRef,
  onChange,
  textareaRef,
  value,
}: {
  disabled: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  onChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-2xl border border-border bg-surface p-2 shadow-raise transition focus-within:border-accent">
          <label className="sr-only" htmlFor="chat-question">
            Question
          </label>
          <textarea
            className="max-h-48 min-h-[64px] w-full resize-none border-0 bg-transparent px-3 py-3 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-faint focus:outline-none focus-visible:outline-none disabled:text-ink-faint"
            disabled={disabled}
            id="chat-question"
            maxLength={2000}
            name="question"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !disabled &&
                !pending
              ) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
            placeholder={
              disabled
                ? "Embed the corpus to start asking questions"
                : "Ask about returns, shipping, allergens, discounts…"
            }
            ref={textareaRef}
            required
            rows={1}
            value={value}
          />
          <div className="flex items-center justify-between gap-3 px-1.5 pb-0.5">
            <span className="text-xs text-ink-faint">
              Grounded in synthetic docs. Enter to send.
            </span>
            <button
              aria-label="Generate answer"
              className="btn btn-primary size-9 rounded-full p-0"
              disabled={disabled || pending}
              type="submit"
            >
              {pending ? (
                <span
                  aria-hidden="true"
                  className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
              ) : (
                <SendIcon className="size-[18px]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sources panel + chunk dialog
 * ------------------------------------------------------------------ */

function EvidenceCardBody({ item }: { item: EvidenceItem }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-accent-deep">
          <span className="grid size-5 place-items-center rounded-md bg-accent-soft">
            {item.labelNumber}
          </span>
          {item.rankLabel}
        </span>
        <span className="tnum font-mono text-xs text-ink-muted">
          {item.scoreLabel}
        </span>
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <SourceIcon className="size-3.5 shrink-0 text-ink-faint" />
        {item.source}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{item.section}</p>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-ink-muted">{item.text}</p>
    </>
  );
}

function SourcesPanel({
  citedItems,
  focusId,
  focusToken,
  onClose,
  onOpenChunk,
  retrievedCount,
}: {
  citedItems: EvidenceItem[];
  focusId: string | null;
  focusToken: number;
  onClose: () => void;
  onOpenChunk: (item: EvidenceItem) => void;
  retrievedCount: number;
}) {
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const closeRef = useRef<HTMLButtonElement>(null);

  // On mobile the panel overlays the chat, so move focus into it and hand focus
  // back to the trigger on close. On desktop it is an inline column, so leave
  // focus on the citation chip the user clicked (no jarring jump).
  useEffect(() => {
    const isOverlay =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1023px)").matches;
    if (!isOverlay) {
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => {
      if (previous?.isConnected) {
        previous.focus();
      }
    };
  }, []);

  useEffect(() => {
    if (!focusId || focusToken === 0) {
      return;
    }
    // Defer so the flash and scroll land after the panel's slide-in settles.
    const start = setTimeout(() => {
      const card = cardRefs.current.get(focusId);
      if (!card) {
        return;
      }
      card.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      card.removeAttribute("data-flash");
      void card.offsetWidth;
      card.setAttribute("data-flash", "true");
    }, 130);
    const end = setTimeout(() => {
      cardRefs.current.get(focusId)?.removeAttribute("data-flash");
    }, 1130);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [focusId, focusToken]);

  return (
    <aside
      aria-label="Sources"
      className="panel-in fixed inset-y-0 right-0 z-40 flex w-[86%] max-w-[360px] flex-col border-l border-border bg-surface shadow-pop lg:static lg:z-auto lg:w-[360px] lg:shadow-none"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-ink">Sources</p>
          <p className="text-xs text-ink-muted">
            {citedItems.length} cited
            {retrievedCount > citedItems.length
              ? ` of ${retrievedCount} retrieved`
              : ""}
          </p>
        </div>
        <button
          aria-label="Close sources"
          className="icon-btn size-8"
          onClick={onClose}
          ref={closeRef}
          type="button"
        >
          <CloseIcon className="size-5" />
        </button>
      </div>

      {citedItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="grid size-10 place-items-center rounded-xl bg-sunken text-ink-faint">
            <SourceIcon className="size-5" />
          </span>
          <p className="text-sm font-medium text-ink">No cited sources</p>
          <p className="text-xs leading-5 text-ink-faint">
            When an answer cites the documents, the exact chunks it used show up
            here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-2.5">
            {citedItems.map((item) => (
              <button
                className="evidence-card w-full p-3.5 text-left"
                data-active={item.id === focusId ? "true" : undefined}
                key={item.id}
                onClick={() => onOpenChunk(item)}
                ref={(node) => {
                  if (node) {
                    cardRefs.current.set(item.id, node);
                  } else {
                    cardRefs.current.delete(item.id);
                  }
                }}
                type="button"
              >
                <EvidenceCardBody item={item} />
                <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-accent-deep">
                  View full chunk
                  <ArrowRightIcon className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function ChunkDialog({
  item,
  onClose,
}: {
  item: EvidenceItem;
  onClose: () => void;
}) {
  return (
    <Dialog
      ariaLabel={`Source ${item.labelNumber}: ${item.source}`}
      maxWidth="max-w-2xl"
      onClose={onClose}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-accent-soft font-mono text-xs font-semibold text-accent-deep">
              {item.labelNumber}
            </span>
            <h2 className="truncate text-base font-semibold text-ink">
              {item.source}
            </h2>
          </div>
          <p className="mt-1 text-xs text-ink-muted">{item.section}</p>
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

      <div className="grid grid-cols-3 gap-3 border-b border-border px-5 py-4">
        <StatCell label="Score" value={item.scoreLabel.replace("Score ", "")} />
        <StatCell label="Rank" value={item.rankLabel.replace("Rank ", "#")} />
        <StatCell label="Tokens" value={`~${item.tokenEstimate}`} />
      </div>

      <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
        <p className="mb-2 font-mono text-xs text-ink-faint">{item.id}</p>
        <p className="whitespace-pre-wrap text-sm leading-7 text-ink">{item.text}</p>
      </div>
    </Dialog>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Dialog({
  ariaLabel,
  children,
  maxWidth,
  onClose,
}: {
  ariaLabel: string;
  children: ReactNode;
  maxWidth: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "Tab" && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (items.length === 0) {
          return;
        }
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="dialog-overlay fixed inset-0 z-50 grid place-items-center p-4"
      onClick={onClose}
    >
      <div
        aria-label={ariaLabel}
        aria-modal="true"
        className={`dialog-panel ${maxWidth}`}
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
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
            Knowledge base
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
            Evaluations
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
      <StatusPill tone={allPassed ? "success" : "warning"}>
        {allPassed ? "All passing" : `${result.total - result.passed} failing`}
      </StatusPill>
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
      <StatusPill tone={item.category === "Guardrail" ? "warning" : "neutral"}>
        {item.category}
      </StatusPill>
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

function StatusPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/25 bg-success-soft text-success"
      : tone === "warning"
        ? "border-warning/25 bg-warning-soft text-warning"
        : tone === "danger"
          ? "border-danger/25 bg-danger-soft text-danger"
          : "border-border bg-canvas text-ink-muted";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass}`}
    >
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

function MenuGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={1.6}
      viewBox="0 0 24 24"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function buildEvidenceItems(
  groundedAnswer: GroundedAnswerResponse | null,
): EvidenceItem[] {
  if (!groundedAnswer) {
    return [];
  }
  return groundedAnswer.retrieval.results.map((result) => ({
    id: result.chunkId,
    label: result.citationLabel,
    labelNumber: result.citationLabel.replace(/[[\]]/g, ""),
    source: result.source,
    section: result.section,
    text: result.text,
    score: result.score,
    scoreLabel: `Score ${formatRetrievalScore(result.score)}`,
    rankLabel: `Rank ${result.rank}`,
    tokenEstimate: result.tokenEstimate,
  }));
}

function filterCitedEvidence(
  groundedAnswer: GroundedAnswerResponse | null,
  retrievedItems: EvidenceItem[],
): EvidenceItem[] {
  if (!groundedAnswer) {
    return [];
  }
  const cited = new Set(
    groundedAnswer.structuredAnswer.paragraphs.flatMap(
      (paragraph) => paragraph.citations,
    ),
  );
  if (cited.size === 0) {
    return [];
  }
  return retrievedItems.filter((item) => cited.has(item.label));
}

// The model embeds citation markers like "[1]" directly in the answer text.
// We render our own clickable chips from the citations array, so strip the raw
// markers to avoid showing each citation twice.
function stripCitationMarkers(text: string): string {
  return text.replace(/\s*\[\d+\]/g, "").trim();
}

function countSections(markdown: string) {
  return markdown.split(/\r?\n/).filter((line) => line.startsWith("## ")).length;
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
