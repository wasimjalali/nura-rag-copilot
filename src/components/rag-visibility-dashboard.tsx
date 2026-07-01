"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";

import type { DocumentChunk, KnowledgeDocument } from "@/lib/rag/types";
import { embeddingConfig as defaultEmbeddingConfig } from "@/lib/rag/embedding-config";
import type { GroundedAnswerResponse } from "@/lib/rag/grounded-answer";
import { formatRetrievalScore } from "@/lib/rag/retrieval";
import {
  summarizeEmbeddingStorageStatus,
  type EmbeddingStorageStatus,
} from "@/lib/rag/storage-records";
import { MANUAL_EVAL_SET } from "@/lib/eval/manual-eval-set";
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
  RetrievalIcon,
  SendIcon,
  SettingsIcon,
  SourceIcon,
} from "@/components/icons";

type WorkspaceView = "chat" | "knowledge" | "retrieval" | "evaluations" | "settings";

type EmbeddingConfig = typeof defaultEmbeddingConfig;

type RagVisibilityDashboardProps = {
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
  addDocumentAction: (formData: FormData) => Promise<void>;
  embedAction: () => Promise<void>;
  generateAnswerAction: (formData: FormData) => Promise<void>;
  embeddingConfig: EmbeddingConfig;
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
  { id: "retrieval", label: "Retrieval", icon: RetrievalIcon },
  { id: "evaluations", label: "Evaluations", icon: EvaluationsIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

const QUESTION_POOL = [
  "Can customers return opened products?",
  "Does express shipping change the order cutoff?",
  "How much can an agent discount without manager approval?",
  "How do I pause a subscription for a month?",
  "Which allergens are declared for the plant protein?",
  "What should support say when the evidence is missing?",
];

const GENERATION_STEPS = [
  "Embedding your question",
  "Searching the knowledge base",
  "Ranking the retrieved chunks",
  "Writing a grounded answer",
  "Checking every citation",
];

export function RagVisibilityDashboard({
  documents,
  chunks,
  addDocumentAction,
  embedAction,
  generateAnswerAction,
  embeddingConfig,
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

  const storageSummary = summarizeEmbeddingStorageStatus(embeddingStorageStatus);
  const retrievalReady = embeddingStorageStatus.embeddedChunks > 0;
  const totalWords = useMemo(
    () => documents.reduce((sum, document) => sum + countWords(document.text), 0),
    [documents],
  );

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
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        setSourcesOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setMobileNavOpen(false)}
            type="button"
          />
          <div className="panel-in absolute inset-y-0 left-0 w-[264px]">
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
          </div>
        </div>
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
              {activeView === "retrieval" ? (
                <RetrievalView
                  chunks={chunks}
                  embedAction={embedAction}
                  embeddingConfig={embeddingConfig}
                  storageSummary={storageSummary}
                  totalWords={totalWords}
                />
              ) : null}
              {activeView === "evaluations" ? <EvaluationsView /> : null}
              {activeView === "settings" ? (
                <SettingsView
                  documentsCount={documents.length}
                  embeddingConfig={embeddingConfig}
                  storageSummary={storageSummary}
                />
              ) : null}
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
    <div aria-live="polite" className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {!ready ? (
          <SetupNotice />
        ) : pending ? (
          <div className="flex flex-col gap-6">
            {pendingQuestion ? <UserMessage text={pendingQuestion} /> : null}
            <GenerationStepper />
          </div>
        ) : !hasConversation ? (
          <ChatWelcome onRunQuestion={onRunQuestion} />
        ) : (
          <div className="flex flex-col gap-6">
            {submittedQuestion ? <UserMessage text={submittedQuestion} /> : null}
            {error ? (
              <ErrorMessage message={error} />
            ) : groundedAnswer ? (
              <AnswerMessage
                activeEvidenceId={activeEvidenceId}
                citedItems={citedItems}
                groundedAnswer={groundedAnswer}
                onFocusEvidence={onFocusEvidence}
                onOpenSources={onOpenSources}
                onRunQuestion={onRunQuestion}
                submittedQuestion={submittedQuestion}
              />
            ) : null}
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
        {QUESTION_POOL.slice(0, 4).map((sample) => (
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
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] leading-6 text-white shadow-sm">
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
  onRunQuestion,
  submittedQuestion,
}: {
  activeEvidenceId: string | null;
  citedItems: EvidenceItem[];
  groundedAnswer: GroundedAnswerResponse;
  onFocusEvidence: (id: string) => void;
  onOpenSources: () => void;
  onRunQuestion: (value: string) => void;
  submittedQuestion: string;
}) {
  const grounded = groundedAnswer.structuredAnswer.answerType === "grounded";
  const citedCount = citedItems.length;
  const related = pickRelated(submittedQuestion, 3);

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
            <p key={index}>
              {stripCitationMarkers(paragraph.text)}
              {paragraph.citations.map((citation) => {
                const item = citedItems.find((evidence) => evidence.label === citation);
                return (
                  <button
                    className="cite ml-1 align-baseline"
                    data-active={
                      item && item.id === activeEvidenceId ? "true" : undefined
                    }
                    disabled={!item}
                    key={`${index}-${citation}`}
                    onClick={() => item && onFocusEvidence(item.id)}
                    title={item ? `${item.source} · ${item.section}` : undefined}
                    type="button"
                  >
                    {citation}
                  </button>
                );
              })}
            </p>
          ))}
        </div>

        {citedCount > 0 ? (
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

        {related.length > 0 ? (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-ink-muted">Related</p>
            <div className="flex flex-col gap-1.5">
              {related.map((item) => (
                <button
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left text-sm text-ink transition hover:border-border-strong hover:shadow-card"
                  key={item}
                  onClick={() => onRunQuestion(item)}
                  type="button"
                >
                  <span>{item}</span>
                  <ArrowRightIcon className="size-4 shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GenerationStepper() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        return;
      }
    }
    const timer = setInterval(() => {
      setStep((current) => Math.min(current + 1, GENERATION_STEPS.length - 1));
    }, 850);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="msg-in flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-brand shadow-sm">
        <NuraMark tone="dark" className="size-5" />
      </span>
      <div className="flex-1 pt-1">
        <p className="mb-3 text-sm font-semibold text-ink">Working through it</p>
        <ol className="flex flex-col gap-2.5">
          {GENERATION_STEPS.map((label, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li
                className="step-line flex items-center gap-2.5 text-sm"
                key={label}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <span
                  className={[
                    "grid size-5 shrink-0 place-items-center rounded-full",
                    done
                      ? "bg-accent text-white"
                      : active
                        ? "bg-accent-soft text-accent-deep"
                        : "bg-sunken text-ink-faint",
                  ].join(" ")}
                >
                  {done ? (
                    <CheckIcon className="size-3" />
                  ) : active ? (
                    <span className="size-2.5 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span className={done || active ? "text-ink" : "text-ink-faint"}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
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
        The corpus has not been embedded yet. Open Knowledge base or Retrieval and
        run the embed step, then come back to ask questions.
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
    <aside className="panel-in fixed inset-y-0 right-0 z-40 flex w-[86%] max-w-[360px] flex-col border-l border-border bg-surface shadow-pop lg:static lg:z-auto lg:w-[360px] lg:shadow-none">
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
          <form action={embedAction}>
            <EmbedButton retrievalReady={retrievalReady} />
          </form>
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

function EmbedButton({ retrievalReady }: { retrievalReady: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary h-10 px-3.5 text-sm" disabled={pending} type="submit">
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

  async function handle(formData: FormData) {
    setError(null);
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
            Use <code className="font-mono">## Heading</code> lines to define sections.
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
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink-muted" htmlFor="doc-title">
            Title
          </label>
          <input
            className="field-input px-3 py-2.5 text-sm text-ink outline-none"
            id="doc-title"
            name="title"
            placeholder="Warranty policy"
            required
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
            required
          />
        </div>
        {error ? (
          <p className="text-[13px] font-medium text-danger">{error}</p>
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
 * Retrieval
 * ------------------------------------------------------------------ */

function RetrievalView({
  chunks,
  embedAction,
  embeddingConfig,
  storageSummary,
  totalWords,
}: {
  chunks: DocumentChunk[];
  embedAction: () => Promise<void>;
  embeddingConfig: EmbeddingConfig;
  storageSummary: ReturnType<typeof summarizeEmbeddingStorageStatus>;
  totalWords: number;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Retrieval</h1>
        <p className="mt-1 text-sm text-ink-muted">
          How chunks become vectors and how questions find them.
        </p>
      </div>

      <section className="card p-5">
        <SectionLabel>Evidence pool</SectionLabel>
        <h2 className="mt-2 text-lg font-semibold text-ink">
          Every stored chunk is retrievable evidence
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          This is the evidence pool: each stored chunk keeps enough context to be
          useful, plus source metadata so future answers can cite evidence.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCell label="Documents" value={storageSummary.storedDocumentsLabel} />
          <StatCell label="Preview chunks" value={`${chunks.length} chunks`} />
          <StatCell label="Words" value={totalWords.toLocaleString("en-US")} />
          <StatCell label="Vector size" value={`${embeddingConfig.dimensions} dims`} />
        </dl>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="card p-5">
          <SectionLabel>Embedding readiness</SectionLabel>
          <h3 className="mt-2 text-base font-semibold text-ink">
            Chunks and questions share one vector space
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            The embedding model converts both stored chunks and submitted
            questions into fixed-length lists of numbers, so Convex can compare
            meaning with vector search.
          </p>
          <dl className="mt-5 flex flex-col gap-2">
            <KeyValue label="Model" value={embeddingConfig.model} />
            <KeyValue
              label="Vector size"
              value={`${embeddingConfig.dimensions} dimensions`}
            />
            <KeyValue label="Provider" value={embeddingConfig.provider} />
            <KeyValue label="Top matches per query" value="5 chunks" />
          </dl>
        </section>

        <section className="card flex flex-col p-5">
          <SectionLabel>Storage status</SectionLabel>
          <h3 className="mt-2 text-base font-semibold text-ink">
            Store reviewed chunks and generate real embeddings
          </h3>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            {storageSummary.lastRunMessage}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <StatCell label="Documents" value={storageSummary.storedDocumentsLabel} />
            <StatCell label="Chunks" value={storageSummary.storedChunksLabel} />
            <StatCell label="Embeddings" value={storageSummary.embeddedChunksLabel} />
            <StatCell label="Last run" value={storageSummary.lastRunLabel} />
          </dl>
          <form action={embedAction} className="mt-auto pt-5">
            <RetrievalEmbedButton />
          </form>
        </section>
      </div>
    </div>
  );
}

function RetrievalEmbedButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary h-11 w-full text-sm" disabled={pending} type="submit">
      {pending ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      ) : (
        <LayersIcon className="size-4" />
      )}
      Store and embed chunks
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Evaluations
 * ------------------------------------------------------------------ */

function EvaluationsView() {
  const categories = ["Grounding", "Guardrail", "Retrieval", "Visibility"] as const;
  const counts = categories.map((category) => ({
    category,
    count: MANUAL_EVAL_SET.filter((item) => item.category === category).length,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Evaluations</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The manual evaluation battery: {MANUAL_EVAL_SET.length} questions that each
          target one behavior the copilot has to get right.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map(({ category, count }) => (
          <StatCell key={category} label={category} value={`${count} checks`} />
        ))}
      </dl>

      <div className="flex flex-col gap-2.5">
        {MANUAL_EVAL_SET.map((item) => (
          <article className="card flex items-start gap-4 p-4" key={item.id}>
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-deep">
              <CheckIcon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-ink">{item.question}</h3>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{item.expectation}</p>
            </div>
            <StatusPill tone={item.category === "Guardrail" ? "warning" : "neutral"}>
              {item.category}
            </StatusPill>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

function SettingsView({
  documentsCount,
  embeddingConfig,
  storageSummary,
}: {
  documentsCount: number;
  embeddingConfig: EmbeddingConfig;
  storageSummary: ReturnType<typeof summarizeEmbeddingStorageStatus>;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">
          The models, storage and guardrails behind every answer.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <SettingsCard
          rows={[
            ["Answer model", "gpt-5.4-mini"],
            ["Serving", "Microsoft Foundry"],
            ["Strategy", "Retrieval-augmented"],
          ]}
          title="Answer model"
        />
        <SettingsCard
          rows={[
            ["Embedding model", embeddingConfig.model],
            ["Vector dimensions", `${embeddingConfig.dimensions}`],
            ["Provider", embeddingConfig.provider],
          ]}
          title="Embeddings"
        />
        <SettingsCard
          rows={[
            ["Database", "Convex"],
            ["Source documents", `${documentsCount}`],
            ["Stored chunks", storageSummary.storedChunksLabel],
            ["Embedded chunks", storageSummary.embeddedChunksLabel],
            ["Last embedded", storageSummary.lastEmbeddedAtLabel],
          ]}
          title="Storage"
        />
        <SettingsCard
          rows={[
            ["Synthetic docs only", "Enabled"],
            ["Missing-evidence refusal", "Enabled"],
            ["Paragraph citations", "Required"],
            ["Medical advice", "Blocked"],
          ]}
          title="Guardrails"
        />
      </div>
    </div>
  );
}

function SettingsCard({
  rows,
  title,
}: {
  rows: Array<[string, string]>;
  title: string;
}) {
  return (
    <article className="card p-5">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <dl className="mt-3 flex flex-col">
        {rows.map(([label, value], index) => (
          <div
            className={[
              "flex items-center justify-between gap-4 py-2.5",
              index === 0 ? "" : "border-t border-border",
            ].join(" ")}
            key={label}
          >
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="text-right font-mono text-xs font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">
      {children}
    </p>
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

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-canvas px-3 py-2.5">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-right font-mono text-xs font-medium text-ink">{value}</dd>
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

function pickRelated(exclude: string, count: number): string[] {
  return QUESTION_POOL.filter((question) => question !== exclude).slice(0, count);
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
