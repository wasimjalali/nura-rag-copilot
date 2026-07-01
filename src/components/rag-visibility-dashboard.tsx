import type { DocumentChunk, KnowledgeDocument } from "@/lib/rag/types";
import type { embeddingConfig } from "@/lib/rag/embedding-config";
import type { GroundedAnswerResponse } from "@/lib/rag/grounded-answer";
import {
  formatRetrievalScore,
} from "@/lib/rag/retrieval";
import {
  summarizeEmbeddingStorageStatus,
  type EmbeddingStorageStatus,
} from "@/lib/rag/storage-records";

type RagVisibilityDashboardProps = {
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
  embedAction: () => Promise<void>;
  generateAnswerAction: (formData: FormData) => Promise<void>;
  embeddingConfig: typeof embeddingConfig;
  embeddingStorageStatus: EmbeddingStorageStatus;
  groundedAnswer?: GroundedAnswerResponse | null;
  generateAnswerError?: string | null;
  submittedQuestion?: string;
};

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
  const totalWords = documents.reduce(
    (sum, document) => sum + countWords(document.text),
    0,
  );
  const storageSummary = summarizeEmbeddingStorageStatus(
    embeddingStorageStatus,
  );
  const retrievalReady = embeddingStorageStatus.embeddedChunks > 0;

  return (
    <main className="min-h-screen bg-[#f7f1e5] text-[#111827]">
      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-5 border-b border-[#d8cdbb] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#123c69]">
              Project 01 · Step 6
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#071a33]">
              RAG visibility
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#39465a]">
              Now the answer model writes from retrieved evidence, while the
              supporting chunks stay visible for inspection.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Documents" value={documents.length.toString()} />
            <Metric label="Chunks" value={chunks.length.toString()} />
            <Metric label="Words" value={totalWords.toLocaleString("en-US")} />
          </div>
        </header>

        <div className="mt-6 border border-[#b8c4d4] bg-white p-4 text-sm leading-6 text-[#123c69] shadow-sm">
          This is the evidence pool: each stored chunk keeps enough context to
          be useful, plus source metadata so future answers can cite evidence.
        </div>

        <section className="mt-6 border border-[#ded4c4] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#123c69]">
                Embedding readiness
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#071a33]">
                Reviewed chunks and questions share one vector space
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#39465a]">
                The embedding model converts both stored chunks and submitted
                questions into fixed-length lists of numbers, so Convex can
                compare meaning with vector search.
              </p>
            </div>
            <dl className="grid min-w-[260px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="border border-[#c7d1dc] bg-[#f8fbff] p-3">
                <dt className="text-xs uppercase tracking-[0.14em] text-[#69778a]">
                  Model
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-[#071a33]">
                  {embeddingConfig.model}
                </dd>
              </div>
              <div className="border border-[#c7d1dc] bg-[#f8fbff] p-3">
                <dt className="text-xs uppercase tracking-[0.14em] text-[#69778a]">
                  Vector size
                </dt>
                <dd className="mt-1 font-mono text-sm font-semibold text-[#071a33]">
                  {`${embeddingConfig.dimensions} dimensions`}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mt-6 border border-[#c7d1dc] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#123c69]">
                Storage status
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#071a33]">
                Store reviewed chunks and generate real embeddings
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#39465a]">
                This action sends the reviewed synthetic chunks to Convex,
                calls Microsoft Foundry for embeddings, validates 1536
                dimensions, and stores the vectors server-side.
              </p>
              <p className="mt-3 text-sm font-medium text-[#123c69]">
                {storageSummary.lastRunMessage}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
              <Metric
                label="Preview"
                value={`${chunks.length.toLocaleString("en-US")} chunks`}
              />
              <Metric
                label="Documents"
                value={storageSummary.storedDocumentsLabel}
              />
              <Metric label="Chunks" value={storageSummary.storedChunksLabel} />
              <Metric
                label="Embeddings"
                value={storageSummary.embeddedChunksLabel}
              />
              <div className="border border-[#ded4c4] bg-white p-3 shadow-sm sm:col-span-2">
                <dt className="text-xs uppercase tracking-[0.14em] text-[#69778a]">
                  Last run
                </dt>
                <dd className="mt-2 font-mono text-sm font-semibold text-[#071a33]">
                  {storageSummary.lastRunLabel}
                  <span className="ml-2 text-[#5f6d7f]">
                    {storageSummary.lastEmbeddedAtLabel}
                  </span>
                </dd>
              </div>
              <form action={embedAction} className="sm:col-span-2">
                <button
                  className="w-full border border-[#123c69] bg-[#123c69] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b2b4e]"
                  type="submit"
                >
                  Store and embed chunks
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-[#b9c6d6] bg-white p-5 shadow-[0_18px_45px_rgba(7,26,51,0.08)]">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(380px,0.68fr)]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#123c69]">
                Grounded generation
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#071a33]">
                Generate grounded answer
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#39465a]">
                The system retrieves evidence first, then asks the answer model
                to respond only from those chunks. The citations below keep the
                answer traceable.
              </p>

              <form action={generateAnswerAction} className="mt-5">
                <label className="sr-only" htmlFor="retrieval-question">
                  Question
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <textarea
                    className="min-h-24 flex-1 resize-none rounded-lg border border-[#c7d1dc] bg-[#fbfaf7] px-4 py-3 text-sm leading-6 text-[#071a33] outline-none transition placeholder:text-[#758295] focus:border-[#123c69] focus:bg-white focus:ring-2 focus:ring-[#123c69]/15 disabled:bg-[#f1eadf] disabled:text-[#69778a] sm:min-h-12"
                    defaultValue={submittedQuestion}
                    disabled={!retrievalReady}
                    id="retrieval-question"
                    name="question"
                    placeholder="Can customers return opened products?"
                    required
                    rows={2}
                  />
                  <button
                    className="min-h-12 rounded-lg border border-[#123c69] bg-[#123c69] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b2b4e] disabled:cursor-not-allowed disabled:border-[#9aa8b8] disabled:bg-[#9aa8b8]"
                    disabled={!retrievalReady}
                    type="submit"
                  >
                    Generate answer
                  </button>
                </div>
              </form>
            </div>

            <GroundedAnswerPanel
              error={generateAnswerError}
              groundedAnswer={groundedAnswer}
              ready={retrievalReady}
            />
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#071a33]">Documents</h2>
              <span className="font-mono text-xs text-[#5f6d7f]">
                {documents.length} files
              </span>
            </div>

            {documents.length === 0 ? (
              <EmptyState message="No synthetic documents found." />
            ) : (
              <div className="grid gap-3">
                {documents.map((document) => (
                  <article
                    className="border border-[#ded4c4] bg-white p-4 shadow-sm"
                    key={document.source}
                  >
                    <p className="font-mono text-xs font-semibold text-[#123c69]">
                      {document.source}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-[#071a33]">
                      {document.title}
                    </h3>
                    <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#4b5870]">
                      <div>
                        <dt className="uppercase tracking-[0.14em] text-[#69778a]">
                          Sections
                        </dt>
                        <dd className="mt-1 font-mono font-semibold text-[#071a33]">
                          {countSections(document.text)}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-[0.14em] text-[#69778a]">
                          Words
                        </dt>
                        <dd className="mt-1 font-mono font-semibold text-[#071a33]">
                          {countWords(document.text)}
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#071a33]">Chunk preview</h2>
              <span className="font-mono text-xs text-[#5f6d7f]">
                {chunks.length} chunks
              </span>
            </div>

            {chunks.length === 0 ? (
              <EmptyState message="No chunks generated yet." />
            ) : (
              <div className="grid gap-3">
                {chunks.map((chunk) => (
                  <article
                    className="border border-[#ded4c4] bg-white p-4 shadow-sm"
                    key={chunk.id}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-mono text-xs font-semibold text-[#123c69]">
                        {chunk.id}
                      </p>
                      <p className="font-mono text-xs text-[#5f6d7f]">
                        ~{chunk.tokenEstimate} tokens
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="border border-[#c7d1dc] bg-[#f8fbff] px-2 py-1 text-[#123c69]">
                        {chunk.source}
                      </span>
                      <span className="border border-[#c7d1dc] bg-[#f8fbff] px-2 py-1 text-[#123c69]">
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
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#ded4c4] bg-white p-3 shadow-sm">
      <dt className="text-xs uppercase tracking-[0.14em] text-[#69778a]">
        {label}
      </dt>
      <dd className="mt-2 font-mono text-xl font-semibold text-[#071a33]">
        {value}
      </dd>
    </div>
  );
}

function GroundedAnswerPanel({
  error,
  groundedAnswer,
  ready,
}: {
  error: string | null;
  groundedAnswer: GroundedAnswerResponse | null;
  ready: boolean;
}) {
  if (!ready) {
    return (
      <div className="rounded-lg border border-dashed border-[#c9bda9] bg-[#fbfaf7] p-5 text-sm font-medium text-[#5b4b38]">
        Store and embed chunks before answer generation.
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#d7b6a5] bg-[#fff8f4] p-5 text-sm font-medium text-[#7a341d]">
        {error}
      </div>
    );
  }

  if (!groundedAnswer) {
    return (
      <div className="rounded-lg border border-dashed border-[#c9bda9] bg-[#fbfaf7] p-5 text-sm leading-6 text-[#4b5870]">
        Ask a question to generate an answer and inspect the cited evidence.
      </div>
    );
  }

  const citedResults = groundedAnswer.retrieval.results;

  return (
    <div className="grid gap-4">
      <section className="rounded-lg border border-[#b9c6d6] bg-[#fbfdff] p-4 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[#d8cdbb] pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#071a33]">
              Grounded answer
            </p>
            <p className="mt-1 font-mono text-xs text-[#5f6d7f]">
              {groundedAnswer.answerModel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {citedResults.map((result) => (
              <span
                className="rounded border border-[#c7d1dc] bg-white px-2 py-1 font-mono text-xs font-semibold text-[#123c69]"
                key={result.chunkId}
              >
                {result.citationLabel}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-4 text-base leading-7 text-[#1f2a3a]">
          {groundedAnswer.answer}
        </p>
      </section>

      <section>
        <div className="flex flex-col gap-2 border-b border-[#d8cdbb] pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#071a33]">
              Cited evidence
            </p>
            <p className="mt-1 text-xs text-[#5f6d7f]">
              {groundedAnswer.retrieval.embeddingModel} ·{" "}
              {groundedAnswer.retrieval.embeddingDimensions} dims
            </p>
          </div>
          <span className="font-mono text-xs text-[#5f6d7f]">
            {citedResults.length} chunks
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {citedResults.map((result) => (
            <article
              className="rounded-lg border border-[#d5dfeb] bg-[#fbfdff] p-4 shadow-sm"
              key={result.chunkId}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-[#123c69]">
                    {result.citationLabel} · Rank {result.rank} ·{" "}
                    {result.chunkId}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded border border-[#c7d1dc] bg-white px-2 py-1 text-[#123c69]">
                      {result.source}
                    </span>
                    <span className="rounded border border-[#c7d1dc] bg-white px-2 py-1 text-[#123c69]">
                      {result.section}
                    </span>
                  </div>
                </div>
                <p className="font-mono text-xs font-semibold text-[#071a33]">
                  Score {formatRetrievalScore(result.score)}
                </p>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#263244]">
                {result.text}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-[#c9bda9] bg-white/70 p-6 text-sm text-[#4b5870]">
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
