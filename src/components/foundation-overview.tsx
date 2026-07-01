const pipeline = [
  {
    label: "Foundation",
    description:
      "Project scaffold, durable rules, environment docs, and Convex wiring.",
  },
  {
    label: "RAG visibility",
    description: "Synthetic documents, ingestion, chunking, and chunk preview.",
  },
  {
    label: "Retrieval loop",
    description: "Embeddings, Convex vector search, and visible retrieved chunks.",
  },
  {
    label: "Answer loop",
    description: "Grounded GPT-4.1 answers with citations and refusal behavior.",
  },
  {
    label: "Manual eval",
    description:
      "Ten support questions checked for retrieval, faithfulness, and safety.",
  },
];

export function FoundationOverview() {
  return (
    <main className="min-h-screen bg-[#f7f1e5] text-[#111827]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#123c69]">
            Project 01
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#071a33] sm:text-6xl">
            Nura RAG Copilot
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#39465a] sm:text-lg">
            A learn-by-building support copilot for a synthetic supplement
            e-commerce company. This first phase keeps the foundation clear
            before we add documents, embeddings, retrieval, and grounded answers.
          </p>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-5">
          {pipeline.map((step, index) => (
            <article
              className="border border-[#ded4c4] bg-white p-4 shadow-sm"
              key={step.label}
            >
              <p className="font-mono text-sm font-semibold text-[#123c69]">
                {(index + 1).toString().padStart(2, "0")}
              </p>
              <h2 className="mt-3 text-base font-semibold text-[#071a33]">
                {step.label}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#4b5870]">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
