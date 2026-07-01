import { NuraLogo } from "@/components/nura-logo";

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
    description:
      "Grounded GPT-5.4 mini answers with citations and refusal behavior.",
  },
  {
    label: "Manual eval",
    description:
      "Ten support questions checked for retrieval, faithfulness, and safety.",
  },
];

export function FoundationOverview() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <NuraLogo />

        <div className="mt-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-deep">
            Project 01
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.02em] text-ink sm:text-5xl">
            Nura RAG Copilot
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink-muted">
            A learn-by-building support copilot for a synthetic supplement
            e-commerce company. This first phase keeps the foundation clear
            before we add documents, embeddings, retrieval, and grounded answers.
          </p>
        </div>

        <ol className="mt-12 grid gap-3 md:grid-cols-5">
          {pipeline.map((step, index) => (
            <li className="card p-4" key={step.label}>
              <p className="tnum font-mono text-xs font-semibold text-accent-deep">
                {(index + 1).toString().padStart(2, "0")}
              </p>
              <h2 className="mt-3 text-sm font-semibold text-ink">{step.label}</h2>
              <p className="mt-2 text-[13px] leading-6 text-ink-muted">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
