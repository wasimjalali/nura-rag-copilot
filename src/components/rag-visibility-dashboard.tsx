"use client";

import { useMemo, useState, type ReactNode } from "react";

import type { DocumentChunk, KnowledgeDocument } from "@/lib/rag/types";
import { embeddingConfig as defaultEmbeddingConfig } from "@/lib/rag/embedding-config";
import type { GroundedAnswerResponse } from "@/lib/rag/grounded-answer";
import { formatRetrievalScore } from "@/lib/rag/retrieval";
import {
  summarizeEmbeddingStorageStatus,
  type EmbeddingStorageStatus,
} from "@/lib/rag/storage-records";

type WorkspaceView = "chat" | "knowledge" | "retrieval" | "evaluations" | "settings";

type EmbeddingConfig = typeof defaultEmbeddingConfig;

type RagVisibilityDashboardProps = {
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
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
  source: string;
  section: string;
  text: string;
  scoreLabel: string;
  rankLabel: string;
};

const NAV_ITEMS: Array<{
  id: WorkspaceView;
  label: string;
  caption: string;
}> = [
  { id: "chat", label: "Chat", caption: "Grounded replies" },
  { id: "knowledge", label: "Knowledge Base", caption: "Docs and chunks" },
  { id: "retrieval", label: "Retrieval Lab", caption: "Vectors and scores" },
  { id: "evaluations", label: "Evaluations", caption: "Manual checks" },
  { id: "settings", label: "Settings", caption: "Models and policy" },
];

const SAMPLE_QUESTIONS = [
  "Can customers return opened products?",
  "Does express shipping change the cutoff?",
  "What should support say when evidence is missing?",
];

const EVALUATION_ROWS = [
  {
    question: "Can customers return opened products?",
    target: "Grounded answer with return-policy citation.",
    status: "Ready",
  },
  {
    question: "Can this supplement cure headaches?",
    target: "Insufficient-evidence refusal.",
    status: "Guardrail",
  },
  {
    question: "Does express shipping change cutoff time?",
    target: "Answer only from shipping and fulfillment chunks.",
    status: "Ready",
  },
  {
    question: "Which source supports the answer?",
    target: "Show retrieved chunk, score, section, and citation label.",
    status: "Visible",
  },
];

export function RagVisibilityDashboard({
  documents,
  chunks,
  embedAction,
  generateAnswerAction,
  embeddingConfig,
  embeddingStorageStatus,
  groundedAnswer = null,
  generateAnswerError = null,
  submittedQuestion = "",
}: RagVisibilityDashboardProps) {
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
  const storageSummary = summarizeEmbeddingStorageStatus(embeddingStorageStatus);
  const retrievalReady = embeddingStorageStatus.embeddedChunks > 0;
  const totalWords = useMemo(
    () => documents.reduce((sum, document) => sum + countWords(document.text), 0),
    [documents],
  );
  const evidenceItems = useMemo(
    () => buildEvidenceItems(groundedAnswer, chunks),
    [chunks, groundedAnswer],
  );
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const selectedEvidence =
    evidenceItems.find((item) => item.id === selectedEvidenceId) ??
    evidenceItems[0] ??
    null;

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#d9e7ff_0,#f6f8fb_34%,#edf3f8_100%)] text-[#0b1727]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-5 px-4 py-4 sm:px-6 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8 lg:py-6">
        <WorkspaceSidebar
          activeView={activeView}
          documentsCount={documents.length}
          embeddedChunks={embeddingStorageStatus.embeddedChunks}
          navItems={NAV_ITEMS}
          onSelectView={setActiveView}
        />

        <section className="min-w-0 animate-[nura-fade-up_500ms_ease-out] rounded-[28px] border border-[#d7e0ea] bg-white/82 p-3 shadow-[0_30px_90px_rgba(15,39,66,0.14)] backdrop-blur-xl sm:p-4">
          <div className="grid min-h-[calc(100vh-56px)] gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 overflow-hidden rounded-[22px] border border-[#d7e0ea] bg-[#f8fbff]">
              <WorkspaceHeader
                activeView={activeView}
                chunksCount={chunks.length}
                documentsCount={documents.length}
                retrievalReady={retrievalReady}
                totalWords={totalWords}
              />

              <div className="min-h-[680px] p-3 sm:p-5">
                {activeView === "chat" ? (
                  <ChatWorkspace
                    evidenceItems={evidenceItems}
                    generateAnswerAction={generateAnswerAction}
                    generateAnswerError={generateAnswerError}
                    groundedAnswer={groundedAnswer}
                    onSelectEvidence={setSelectedEvidenceId}
                    ready={retrievalReady}
                    selectedEvidenceId={selectedEvidence?.id ?? null}
                    submittedQuestion={submittedQuestion}
                  />
                ) : null}

                {activeView === "knowledge" ? (
                  <KnowledgeWorkspace documents={documents} chunks={chunks} />
                ) : null}

                {activeView === "retrieval" ? (
                  <RetrievalWorkspace
                    chunks={chunks}
                    embedAction={embedAction}
                    embeddingConfig={embeddingConfig}
                    storageSummary={storageSummary}
                  />
                ) : null}

                {activeView === "evaluations" ? <EvaluationWorkspace /> : null}

                {activeView === "settings" ? (
                  <SettingsWorkspace
                    embeddingConfig={embeddingConfig}
                    storageSummary={storageSummary}
                  />
                ) : null}
              </div>
            </div>

            <EvidenceDrawer
              activeView={activeView}
              evidenceItems={evidenceItems}
              onSelectEvidence={setSelectedEvidenceId}
              selectedEvidence={selectedEvidence}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function WorkspaceSidebar({
  activeView,
  documentsCount,
  embeddedChunks,
  navItems,
  onSelectView,
}: {
  activeView: WorkspaceView;
  documentsCount: number;
  embeddedChunks: number;
  navItems: typeof NAV_ITEMS;
  onSelectView: (view: WorkspaceView) => void;
}) {
  return (
    <aside className="animate-[nura-fade-up_420ms_ease-out] rounded-[28px] border border-[#d7e0ea] bg-white/88 p-4 shadow-[0_24px_70px_rgba(15,39,66,0.12)] backdrop-blur-xl lg:sticky lg:top-6 lg:h-[calc(100vh-48px)]">
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-center gap-3 rounded-2xl border border-[#d7e0ea] bg-[#f8fbff] p-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f2742] text-base font-bold text-white shadow-[0_14px_30px_rgba(15,39,66,0.24)]">
            N
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0b1727]">
              Nura RAG
            </p>
            <p className="truncate text-xs font-medium text-[#617085]">
              Support copilot
            </p>
          </div>
        </div>

        <nav className="grid gap-2" aria-label="Workspace">
          {navItems.map((item) => {
            const active = activeView === item.id;

            return (
              <button
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={[
                  "group rounded-2xl border px-3 py-3 text-left transition duration-200",
                  "hover:-translate-y-0.5 hover:border-[#2f6fed] hover:bg-[#f8fbff] hover:shadow-[0_12px_30px_rgba(47,111,237,0.12)]",
                  "focus:outline-none focus:ring-2 focus:ring-[#2f6fed]/30",
                  active
                    ? "border-[#2f6fed] bg-[#d9e7ff] text-[#123a75] shadow-[0_14px_34px_rgba(47,111,237,0.16)]"
                    : "border-transparent bg-transparent text-[#617085]",
                ].join(" ")}
                key={item.id}
                onClick={() => onSelectView(item.id)}
                type="button"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{item.label}</span>
                  <span
                    className={[
                      "h-2.5 w-2.5 rounded-full transition",
                      active ? "bg-[#2f6fed]" : "bg-[#d7e0ea] group-hover:bg-[#2f6fed]",
                    ].join(" ")}
                  />
                </span>
                <span className="mt-1 block text-xs font-medium text-[#617085]">
                  {item.caption}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-3">
          <div className="rounded-2xl border border-[#d7e0ea] bg-[#f8fbff] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#617085]">
              Corpus
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniStat label="Docs" value={documentsCount.toString()} />
              <MiniStat label="Vectors" value={embeddedChunks.toString()} />
            </div>
          </div>
          <div className="rounded-2xl bg-[#0f2742] p-4 text-white shadow-[0_20px_50px_rgba(15,39,66,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d9e7ff]">
              Palette
            </p>
            <p className="mt-2 text-lg font-semibold">Atlas Navy</p>
            <p className="mt-1 text-xs leading-5 text-[#d9e7ff]">
              White workspace, navy authority, blue evidence focus.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function WorkspaceHeader({
  activeView,
  chunksCount,
  documentsCount,
  retrievalReady,
  totalWords,
}: {
  activeView: WorkspaceView;
  chunksCount: number;
  documentsCount: number;
  retrievalReady: boolean;
  totalWords: number;
}) {
  const title =
    activeView === "chat"
      ? "Nura Command Center"
      : activeView === "knowledge"
        ? "Knowledge Base"
        : activeView === "retrieval"
          ? "Retrieval Lab"
          : activeView === "evaluations"
            ? "Evaluation Studio"
            : "Workspace Settings";

  return (
    <header className="border-b border-[#d7e0ea] bg-white px-5 py-5 sm:px-6">
      <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f6fed]">
            Project 01 · Grounded support agent
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#0b1727] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#617085]">
            Paragraph-level citations, visible retrieval, and a bright support
            workspace built around source trust.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 2xl:w-auto 2xl:min-w-[520px]">
          <HeaderMetric label="Documents" value={documentsCount.toString()} />
          <HeaderMetric label="Chunks" value={chunksCount.toString()} />
          <HeaderMetric label="Words" value={totalWords.toLocaleString("en-US")} />
          <HeaderMetric label="Status" value={retrievalReady ? "Ready" : "Setup"} />
        </div>
      </div>
    </header>
  );
}

function ChatWorkspace({
  evidenceItems,
  generateAnswerAction,
  generateAnswerError,
  groundedAnswer,
  onSelectEvidence,
  ready,
  selectedEvidenceId,
  submittedQuestion,
}: {
  evidenceItems: EvidenceItem[];
  generateAnswerAction: (formData: FormData) => Promise<void>;
  generateAnswerError: string | null;
  groundedAnswer: GroundedAnswerResponse | null;
  onSelectEvidence: (id: string) => void;
  ready: boolean;
  selectedEvidenceId: string | null;
  submittedQuestion: string;
}) {
  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="grid gap-4">
        <div className="rounded-[24px] border border-[#d7e0ea] bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,39,66,0.10)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">
                Live question
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#0b1727]">
                Generate grounded answer
              </h2>
            </div>
            <StatusPill tone={ready ? "success" : "muted"}>
              {ready ? "Retrieval ready" : "Embedding setup"}
            </StatusPill>
          </div>

          <form action={generateAnswerAction} className="mt-5">
            <label className="sr-only" htmlFor="retrieval-question">
              Question
            </label>
            <div className="rounded-[22px] border border-[#cbd7e6] bg-[#f8fbff] p-2 transition duration-200 focus-within:border-[#2f6fed] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#2f6fed]/10">
              <textarea
                className="min-h-28 w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-sm leading-6 text-[#0b1727] outline-none placeholder:text-[#8a98aa] disabled:text-[#617085]"
                defaultValue={submittedQuestion}
                disabled={!ready}
                id="retrieval-question"
                name="question"
                placeholder="Can customers return opened products?"
                required
                rows={3}
              />
              <div className="flex flex-col gap-3 border-t border-[#d7e0ea] px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_QUESTIONS.map((question) => (
                    <span
                      className="rounded-full border border-[#d7e0ea] bg-white px-3 py-1 text-xs font-medium text-[#617085]"
                      key={question}
                    >
                      {question}
                    </span>
                  ))}
                </div>
                <button
                  className="rounded-2xl bg-[#0f2742] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(15,39,66,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#123a75] hover:shadow-[0_20px_44px_rgba(18,58,117,0.24)] disabled:cursor-not-allowed disabled:bg-[#9aa8b8] disabled:shadow-none"
                  disabled={!ready}
                  type="submit"
                >
                  Generate answer
                </button>
              </div>
            </div>
          </form>
        </div>

        <GroundedAnswerPanel
          error={generateAnswerError}
          evidenceItems={evidenceItems}
          groundedAnswer={groundedAnswer}
          onSelectEvidence={onSelectEvidence}
          ready={ready}
          selectedEvidenceId={selectedEvidenceId}
        />
      </section>

      <section className="grid content-start gap-4">
        <ProcessCard />
        <div className="rounded-[24px] border border-[#d7e0ea] bg-white p-4 shadow-sm">
          <p className="text-sm font-semibold text-[#0b1727]">Answer contract</p>
          <div className="mt-4 grid gap-3">
            {["Retrieve first", "Cite each paragraph", "Refuse missing evidence"].map(
              (item) => (
                <div
                  className="flex items-center gap-3 rounded-2xl border border-[#d7e0ea] bg-[#f8fbff] px-3 py-2 text-sm font-medium text-[#617085]"
                  key={item}
                >
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2f6fed]" />
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function GroundedAnswerPanel({
  error,
  evidenceItems,
  groundedAnswer,
  onSelectEvidence,
  ready,
  selectedEvidenceId,
}: {
  error: string | null;
  evidenceItems: EvidenceItem[];
  groundedAnswer: GroundedAnswerResponse | null;
  onSelectEvidence: (id: string) => void;
  ready: boolean;
  selectedEvidenceId: string | null;
}) {
  if (!ready) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#b8c6d8] bg-white p-6 text-sm font-medium leading-6 text-[#617085]">
        Store and embed chunks before answer generation.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-[#efc3b6] bg-[#fff8f4] p-6 text-sm font-semibold text-[#8a341c]">
        {error}
      </div>
    );
  }

  if (!groundedAnswer) {
    return (
      <div className="rounded-[24px] border border-dashed border-[#b8c6d8] bg-white p-6">
        <p className="text-sm font-semibold text-[#0b1727]">
          Ask a question to generate an answer and inspect the cited evidence.
        </p>
        <p className="mt-2 text-sm leading-6 text-[#617085]">
          Retrieved chunks will appear as source-backed citations in the answer
          and as selectable evidence in the right panel.
        </p>
      </div>
    );
  }

  return (
    <article className="animate-[nura-fade-up_420ms_ease-out] rounded-[24px] border border-[#cbd7e6] bg-white p-5 shadow-[0_24px_60px_rgba(15,39,66,0.10)]">
      <div className="flex flex-col gap-3 border-b border-[#d7e0ea] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0b1727]">Grounded answer</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone="blue">{groundedAnswer.answerModel}</StatusPill>
            <StatusPill tone={groundedAnswer.structuredAnswer.answerType === "grounded" ? "success" : "warning"}>
              {formatAnswerType(groundedAnswer.structuredAnswer.answerType)}
            </StatusPill>
          </div>
        </div>
        <p className="font-mono text-xs font-semibold text-[#617085]">
          {evidenceItems.length} cited chunks
        </p>
      </div>

      <div className="mt-5 grid gap-5">
        {groundedAnswer.structuredAnswer.paragraphs.map((paragraph, paragraphIndex) => (
          <section
            className="rounded-2xl bg-[#f8fbff] p-4 transition duration-200 hover:bg-[#f3f8ff]"
            key={`${paragraph.text}-${paragraphIndex}`}
          >
            <p className="text-base leading-8 text-[#1f2a3a]">{paragraph.text}</p>
            {paragraph.citations.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {paragraph.citations.map((citation) => {
                  const evidenceItem = evidenceItems.find(
                    (item) => item.label === citation,
                  );

                  return (
                    <button
                      className={[
                        "rounded-full border px-3 py-1.5 font-mono text-xs font-semibold transition duration-200",
                        "hover:-translate-y-0.5 hover:border-[#2f6fed] hover:shadow-[0_10px_24px_rgba(47,111,237,0.16)]",
                        selectedEvidenceId === evidenceItem?.id
                          ? "border-[#2f6fed] bg-[#d9e7ff] text-[#123a75]"
                          : "border-[#cbd7e6] bg-white text-[#123a75]",
                      ].join(" ")}
                      disabled={!evidenceItem}
                      key={`${paragraphIndex}-${citation}`}
                      onClick={() => evidenceItem && onSelectEvidence(evidenceItem.id)}
                      type="button"
                    >
                      {citation}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}

function EvidenceDrawer({
  activeView,
  evidenceItems,
  onSelectEvidence,
  selectedEvidence,
}: {
  activeView: WorkspaceView;
  evidenceItems: EvidenceItem[];
  onSelectEvidence: (id: string) => void;
  selectedEvidence: EvidenceItem | null;
}) {
  return (
    <aside className="rounded-[22px] border border-[#d7e0ea] bg-white p-4 shadow-sm xl:sticky xl:top-8 xl:max-h-[calc(100vh-64px)] xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0b1727]">Evidence</p>
          <p className="mt-1 text-xs font-medium text-[#617085]">
            {activeView === "chat" ? "Answer citations" : "Corpus preview"}
          </p>
        </div>
        <StatusPill tone="blue">{evidenceItems.length} sources</StatusPill>
      </div>

      {selectedEvidence ? (
        <section className="mt-4 rounded-[20px] border border-[#2f6fed] bg-[#d9e7ff] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-semibold text-[#123a75]">
                {selectedEvidence.label}
              </p>
              <h2 className="mt-2 text-lg font-semibold text-[#0b1727]">
                {selectedEvidence.source}
              </h2>
            </div>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 font-mono text-xs font-semibold text-[#123a75]">
              {selectedEvidence.scoreLabel}
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#123a75]">
            {selectedEvidence.section}
          </p>
          <p className="mt-3 text-sm leading-6 text-[#1f2a3a]">
            {selectedEvidence.text}
          </p>
        </section>
      ) : (
        <div className="mt-4 rounded-[20px] border border-dashed border-[#b8c6d8] bg-[#f8fbff] p-4 text-sm text-[#617085]">
          No evidence is available yet.
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {evidenceItems.map((item) => (
          <button
            className={[
              "rounded-[18px] border p-3 text-left transition duration-200",
              "hover:-translate-y-0.5 hover:border-[#2f6fed] hover:bg-[#f8fbff] hover:shadow-[0_14px_30px_rgba(47,111,237,0.12)]",
              selectedEvidence?.id === item.id
                ? "border-[#2f6fed] bg-[#f8fbff]"
                : "border-[#d7e0ea] bg-white",
            ].join(" ")}
            key={item.id}
            onClick={() => onSelectEvidence(item.id)}
            type="button"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs font-semibold text-[#123a75]">
                {item.rankLabel}
              </span>
              <span className="shrink-0 whitespace-nowrap font-mono text-xs font-semibold text-[#617085]">
                {item.scoreLabel}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0b1727]">{item.source}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#617085]">
              {item.text}
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}

function KnowledgeWorkspace({
  documents,
  chunks,
}: {
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
}) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">
              Synthetic sources
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0b1727]">
              Source documents
            </h2>
          </div>
          <StatusPill tone="blue">{documents.length} files</StatusPill>
        </div>
      </section>

      {documents.length === 0 ? (
        <EmptyState message="No synthetic documents found." />
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {documents.map((document) => (
            <article
              className="group rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#2f6fed] hover:shadow-[0_24px_60px_rgba(15,39,66,0.10)]"
              key={document.source}
            >
              <p className="font-mono text-xs font-semibold text-[#123a75]">
                {document.source}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[#0b1727]">
                {document.title}
              </h3>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="Sections" value={countSections(document.text).toString()} />
                <MiniStat label="Words" value={countWords(document.text).toString()} />
              </dl>
            </article>
          ))}
        </section>
      )}

      <section className="rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0b1727]">Chunk preview</h2>
          <span className="font-mono text-xs font-semibold text-[#617085]">
            {chunks.length} chunks
          </span>
        </div>
        {chunks.length === 0 ? (
          <EmptyState message="No chunks generated yet." />
        ) : (
          <div className="grid max-h-[640px] gap-3 overflow-y-auto pr-1">
            {chunks.map((chunk) => (
              <article
                className="rounded-[20px] border border-[#d7e0ea] bg-[#f8fbff] p-4 transition duration-200 hover:border-[#2f6fed] hover:bg-white"
                key={chunk.id}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-mono text-xs font-semibold text-[#123a75]">
                    {chunk.id}
                  </p>
                  <p className="font-mono text-xs text-[#617085]">
                    ~{chunk.tokenEstimate} tokens
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-[#cbd7e6] bg-white px-2.5 py-1 text-[#123a75]">
                    {chunk.source}
                  </span>
                  <span className="rounded-full border border-[#cbd7e6] bg-white px-2.5 py-1 text-[#123a75]">
                    {chunk.section}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#263244]">
                  {chunk.text}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RetrievalWorkspace({
  chunks,
  embedAction,
  embeddingConfig,
  storageSummary,
}: {
  chunks: DocumentChunk[];
  embedAction: () => Promise<void>;
  embeddingConfig: EmbeddingConfig;
  storageSummary: ReturnType<typeof summarizeEmbeddingStorageStatus>;
}) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">
          RAG visibility
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[#0b1727]">
          Evidence pool
        </h2>
        <div className="mt-4 rounded-2xl border border-[#cbd7e6] bg-[#f8fbff] p-4 text-sm leading-6 text-[#123a75]">
          This is the evidence pool: each stored chunk keeps enough context to
          be useful, plus source metadata so future answers can cite evidence.
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">
            Embedding readiness
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[#0b1727]">
            Reviewed chunks and questions share one vector space
          </h3>
          <p className="mt-3 text-sm leading-6 text-[#617085]">
            The embedding model converts both stored chunks and submitted
            questions into fixed-length lists of numbers, so Convex can compare
            meaning with vector search.
          </p>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <MiniStat label="Model" value={embeddingConfig.model} />
            <MiniStat
              label="Vector size"
              value={`${embeddingConfig.dimensions} dimensions`}
            />
          </dl>
        </article>

        <article className="rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">
            Storage status
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[#0b1727]">
            Store reviewed chunks and generate real embeddings
          </h3>
          <p className="mt-3 text-sm font-medium text-[#123a75]">
            {storageSummary.lastRunMessage}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniStat label="Preview" value={`${chunks.length} chunks`} />
            <MiniStat label="Documents" value={storageSummary.storedDocumentsLabel} />
            <MiniStat label="Chunks" value={storageSummary.storedChunksLabel} />
            <MiniStat label="Embeddings" value={storageSummary.embeddedChunksLabel} />
          </div>
          <form action={embedAction} className="mt-4">
            <button
              className="w-full rounded-2xl bg-[#0f2742] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(15,39,66,0.22)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#123a75]"
              type="submit"
            >
              Store and embed chunks
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}

function EvaluationWorkspace() {
  return (
    <div className="grid gap-5">
      <section className="rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">
          Quality loop
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[#0b1727]">
          Manual evaluation set
        </h2>
      </section>

      <section className="grid gap-4 2xl:grid-cols-2">
        {EVALUATION_ROWS.map((row) => (
          <article
            className="rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#2f6fed] hover:shadow-[0_24px_60px_rgba(15,39,66,0.10)]"
            key={row.question}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold leading-6 text-[#0b1727]">
                {row.question}
              </h3>
              <StatusPill tone={row.status === "Guardrail" ? "warning" : "blue"}>
                {row.status}
              </StatusPill>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#617085]">{row.target}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function SettingsWorkspace({
  embeddingConfig,
  storageSummary,
}: {
  embeddingConfig: EmbeddingConfig;
  storageSummary: ReturnType<typeof summarizeEmbeddingStorageStatus>;
}) {
  return (
    <div className="grid gap-5">
      <section className="rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f6fed]">
          Runtime
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[#0b1727]">
          Model and policy settings
        </h2>
      </section>

      <section className="grid gap-4 2xl:grid-cols-2">
        <SettingsCard
          rows={[
            ["Answer model", "gpt-5.4-mini"],
            ["Embedding model", embeddingConfig.model],
            ["Vector dimensions", `${embeddingConfig.dimensions}`],
          ]}
          title="Models"
        />
        <SettingsCard
          rows={[
            ["Database", "Convex"],
            ["Stored documents", storageSummary.storedDocumentsLabel],
            ["Stored chunks", storageSummary.storedChunksLabel],
          ]}
          title="Storage"
        />
        <SettingsCard
          rows={[
            ["Synthetic docs only", "Enabled"],
            ["Missing evidence refusal", "Enabled"],
            ["Paragraph citations", "Required"],
          ]}
          title="Guardrails"
        />
        <SettingsCard
          rows={[
            ["Theme", "Atlas Navy"],
            ["Background", "White and blue mist"],
            ["Accent", "#2f6fed"],
          ]}
          title="Interface"
        />
      </section>
    </div>
  );
}

function ProcessCard() {
  return (
    <div className="rounded-[24px] border border-[#d7e0ea] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-[#0b1727]">RAG run</p>
      <div className="mt-4 grid gap-3">
        {[
          ["01", "Embed question"],
          ["02", "Rank chunks"],
          ["03", "Draft answer"],
          ["04", "Validate citations"],
        ].map(([step, label]) => (
          <div className="flex items-center gap-3" key={step}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#d9e7ff] font-mono text-xs font-semibold text-[#123a75]">
              {step}
            </span>
            <span className="text-sm font-medium text-[#617085]">{label}</span>
          </div>
        ))}
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
    <article className="rounded-[24px] border border-[#d7e0ea] bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#2f6fed]">
      <h3 className="text-lg font-semibold text-[#0b1727]">{title}</h3>
      <dl className="mt-4 grid gap-3">
        {rows.map(([label, value]) => (
          <div
            className="flex items-center justify-between gap-4 rounded-2xl bg-[#f8fbff] px-4 py-3"
            key={label}
          >
            <dt className="text-sm font-medium text-[#617085]">{label}</dt>
            <dd className="text-right font-mono text-xs font-semibold text-[#123a75]">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d7e0ea] bg-[#f8fbff] px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[#617085]">
        {label}
      </dt>
      <dd className="mt-1 truncate font-mono text-lg font-semibold text-[#0b1727]">
        {value}
      </dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#d7e0ea] bg-white px-3 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#617085]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-mono text-sm font-semibold text-[#0b1727]">
        {value}
      </dd>
    </div>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "blue" | "success" | "warning" | "muted";
}) {
  const toneClass =
    tone === "success"
      ? "border-[#b9e2d5] bg-[#e7f7f1] text-[#0f6f56]"
      : tone === "warning"
        ? "border-[#f1d6a7] bg-[#fff7e8] text-[#9a5a00]"
        : tone === "muted"
          ? "border-[#d7e0ea] bg-[#f8fbff] text-[#617085]"
          : "border-[#c4d8ff] bg-[#d9e7ff] text-[#123a75]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}
    >
      {children}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#b8c6d8] bg-white p-6 text-sm text-[#617085]">
      {message}
    </div>
  );
}

function buildEvidenceItems(
  groundedAnswer: GroundedAnswerResponse | null,
  chunks: DocumentChunk[],
): EvidenceItem[] {
  if (groundedAnswer) {
    return groundedAnswer.retrieval.results.map((result) => ({
      id: result.chunkId,
      label: result.citationLabel,
      source: result.source,
      section: result.section,
      text: result.text,
      scoreLabel: `Score ${formatRetrievalScore(result.score)}`,
      rankLabel: `Rank ${result.rank}`,
    }));
  }

  return chunks.slice(0, 5).map((chunk, index) => ({
    id: chunk.id,
    label: `[${index + 1}]`,
    source: chunk.source,
    section: chunk.section,
    text: chunk.text,
    scoreLabel: "Preview",
    rankLabel: `Chunk ${index + 1}`,
  }));
}

function formatAnswerType(
  answerType: GroundedAnswerResponse["structuredAnswer"]["answerType"],
) {
  return answerType === "grounded" ? "grounded" : "insufficient evidence";
}

function countSections(markdown: string) {
  return markdown.split(/\r?\n/).filter((line) => line.startsWith("## ")).length;
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
