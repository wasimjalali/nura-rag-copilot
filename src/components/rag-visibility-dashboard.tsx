import type { DocumentChunk, KnowledgeDocument } from "@/lib/rag/types";

type RagVisibilityDashboardProps = {
  documents: KnowledgeDocument[];
  chunks: DocumentChunk[];
};

export function RagVisibilityDashboard({
  documents,
  chunks,
}: RagVisibilityDashboardProps) {
  const totalWords = documents.reduce(
    (sum, document) => sum + countWords(document.text),
    0,
  );

  return (
    <main className="min-h-screen bg-[#f7f1e5] text-[#111827]">
      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-5 border-b border-[#d8cdbb] pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#123c69]">
              Project 01 · Step 2
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#071a33]">
              RAG visibility
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#39465a]">
              Before embeddings, we inspect the knowledge base and the exact
              chunks that will become searchable meaning vectors.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <Metric label="Documents" value={documents.length.toString()} />
            <Metric label="Chunks" value={chunks.length.toString()} />
            <Metric label="Words" value={totalWords.toLocaleString("en-US")} />
          </div>
        </header>

        <div className="mt-6 border border-[#b8c4d4] bg-white p-4 text-sm leading-6 text-[#123c69] shadow-sm">
          This is what will be embedded next: each chunk keeps enough context to
          be useful, plus source metadata so future answers can cite evidence.
        </div>

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
