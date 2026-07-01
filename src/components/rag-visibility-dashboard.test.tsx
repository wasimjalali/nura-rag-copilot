import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RagVisibilityDashboard } from "./rag-visibility-dashboard";

const documents = [
  {
    source: "return_policy.md",
    title: "Return Policy",
    text: "# Return Policy\n\n## Opened Products\nCustomers can return opened products.",
  },
];

const chunks = [
  {
    id: "return_policy__chunk_001",
    source: "return_policy.md",
    section: "Opened Products",
    text: "Customers can return opened products within the policy window.",
    tokenEstimate: 11,
    createdAt: "2026-07-01T00:00:00.000Z",
  },
];

const embeddingConfig = {
  provider: "azure-openai",
  model: "text-embedding-3-small",
  dimensions: 1536,
  deploymentEnvVar: "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
} as const;

const embeddingStorageStatus = {
  storedDocuments: 10,
  storedChunks: 31,
  embeddedChunks: 30,
  lastRunStatus: "failed",
  lastRunMessage: "1 chunk returned 3 dimensions.",
  lastEmbeddedAt: 1782920000000,
} as const;

describe("RagVisibilityDashboard", () => {
  it("shows documents and chunk preview details", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        embedAction={async () => {}}
        generateAnswerAction={async () => {}}
        embeddingConfig={embeddingConfig}
        embeddingStorageStatus={embeddingStorageStatus}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "RAG visibility" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("return_policy.md")).toHaveLength(2);
    expect(screen.getByText("return_policy__chunk_001")).toBeInTheDocument();
    expect(screen.getByText("Opened Products")).toBeInTheDocument();
    expect(
      screen.getByText(/This is the evidence pool/),
    ).toBeInTheDocument();
    expect(screen.getByText("text-embedding-3-small")).toBeInTheDocument();
    expect(screen.getByText("1536 dimensions")).toBeInTheDocument();
    expect(
      screen.getByText(/The embedding model converts both stored chunks/),
    ).toBeInTheDocument();
    expect(screen.getByText("Storage status")).toBeInTheDocument();
    expect(screen.getByText("31 stored")).toBeInTheDocument();
    expect(screen.getByText("30 embedded")).toBeInTheDocument();
    expect(screen.getByText("1 chunk returned 3 dimensions.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Store and embed chunks" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Generate grounded answer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate answer" }),
    ).toBeInTheDocument();
  });

  it("shows a setup state before embeddings are stored", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        embedAction={async () => {}}
        generateAnswerAction={async () => {}}
        embeddingConfig={embeddingConfig}
        embeddingStorageStatus={{
          ...embeddingStorageStatus,
          embeddedChunks: 0,
        }}
      />,
    );

    expect(
      screen.getByText("Store and embed chunks before answer generation."),
    ).toBeInTheDocument();
  });

  it("shows a grounded answer with cited retrieved evidence", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        embedAction={async () => {}}
        generateAnswerAction={async () => {}}
        embeddingConfig={embeddingConfig}
        embeddingStorageStatus={embeddingStorageStatus}
        groundedAnswer={{
          question: "Can customers return opened products?",
          answer:
            "Yes. Opened products may be returned within 30 days when the customer tried the product and is unsatisfied. [1]",
          answerModel: "gpt-5.4-mini",
          retrieval: {
            embeddingModel: "text-embedding-3-small",
            embeddingDimensions: 1536,
            results: [
              {
                rank: 1,
                score: 0.81234,
                chunkId: "return_policy__chunk_001",
                source: "return_policy.md",
                section: "Opened Products",
                text: "Customers can return opened products within the policy window.",
                tokenEstimate: 11,
                citationLabel: "[1]",
              },
            ],
          },
        }}
        generateAnswerError={null}
        submittedQuestion="Can customers return opened products?"
      />,
    );

    expect(screen.getByText("Grounded answer")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.4-mini")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Yes. Opened products may be returned within 30 days when the customer tried the product and is unsatisfied. [1]",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("[1]").length).toBeGreaterThan(0);
    expect(screen.getByText("Score 0.812")).toBeInTheDocument();
    expect(screen.getAllByText("return_policy.md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Opened Products").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        "Customers can return opened products within the policy window.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("shows an answer error state", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        embedAction={async () => {}}
        generateAnswerAction={async () => {}}
        embeddingConfig={embeddingConfig}
        embeddingStorageStatus={embeddingStorageStatus}
        generateAnswerError="Answer generation failed."
        submittedQuestion="Can customers return opened products?"
      />,
    );

    expect(screen.getByText("Answer generation failed.")).toBeInTheDocument();
  });
});
