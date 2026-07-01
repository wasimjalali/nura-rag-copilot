import { fireEvent, render, screen } from "@testing-library/react";
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
  it("renders the product shell with the expected workspace views", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        addDocumentAction={async () => {}}
        embedAction={async () => {}}
        generateAnswerAction={async () => {}}
        embeddingConfig={embeddingConfig}
        embeddingStorageStatus={embeddingStorageStatus}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Ask a grounded question" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Knowledge base" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retrieval" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Evaluations" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("switches between premium workspace views", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        addDocumentAction={async () => {}}
        embedAction={async () => {}}
        generateAnswerAction={async () => {}}
        embeddingConfig={embeddingConfig}
        embeddingStorageStatus={embeddingStorageStatus}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Knowledge base" }));
    expect(
      screen.getByRole("heading", { name: "Knowledge base" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retrieval" }));
    expect(
      screen.getByRole("heading", { name: "Retrieval" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Evaluations" }));
    expect(
      screen.getByRole("heading", { name: "Evaluations" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("shows documents and chunk preview details", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        addDocumentAction={async () => {}}
        embedAction={async () => {}}
        generateAnswerAction={async () => {}}
        embeddingConfig={embeddingConfig}
        embeddingStorageStatus={embeddingStorageStatus}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Ask a grounded question" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate answer" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Knowledge base" }));
    expect(screen.getAllByText("return_policy.md").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("return_policy__chunk_001")).toBeInTheDocument();
    expect(screen.getAllByText("Opened Products").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Retrieval" }));
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
  });

  it("shows a setup state before embeddings are stored", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        addDocumentAction={async () => {}}
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
        addDocumentAction={async () => {}}
        embedAction={async () => {}}
        generateAnswerAction={async () => {}}
        embeddingConfig={embeddingConfig}
        embeddingStorageStatus={embeddingStorageStatus}
        groundedAnswer={{
          question: "Can customers return opened products?",
          answer:
            "Opened products may be returned within 30 days. [1]\n\nOrders outside the policy window are not eligible. [2]",
          answerModel: "gpt-5.4-mini",
          structuredAnswer: {
            answerType: "grounded",
            paragraphs: [
              {
                text: "Opened products may be returned within 30 days.",
                citations: ["[1]"],
              },
              {
                text: "Orders outside the policy window are not eligible.",
                citations: ["[2]"],
              },
            ],
          },
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
              {
                rank: 2,
                score: 0.61234,
                chunkId: "return_policy__chunk_002",
                source: "return_policy.md",
                section: "Non-Returnable Orders",
                text: "Orders outside the policy window are not eligible.",
                tokenEstimate: 8,
                citationLabel: "[2]",
              },
            ],
          },
        }}
        generateAnswerError={null}
        submittedQuestion="Can customers return opened products?"
      />,
    );

    expect(
      screen.getByText("Opened products may be returned within 30 days."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Orders outside the policy window are not eligible.")
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("[1]").length).toBeGreaterThan(0);
    expect(screen.getAllByText("[2]").length).toBeGreaterThan(0);

    // Cited chunks live in the on-demand sources panel.
    fireEvent.click(screen.getByRole("button", { name: /Sources/ }));
    expect(screen.getAllByText("Score 0.812").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Score 0.612").length).toBeGreaterThan(0);
    expect(screen.getAllByText("return_policy.md").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Opened Products").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        "Customers can return opened products within the policy window.",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("shows an insufficient-evidence answer without paragraph citations", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        addDocumentAction={async () => {}}
        embedAction={async () => {}}
        generateAnswerAction={async () => {}}
        embeddingConfig={embeddingConfig}
        embeddingStorageStatus={embeddingStorageStatus}
        groundedAnswer={{
          question: "Can this cure headaches?",
          answer: "I do not have enough retrieved evidence to answer that question.",
          answerModel: "gpt-5.4-mini",
          structuredAnswer: {
            answerType: "insufficient_evidence",
            paragraphs: [
              {
                text: "I do not have enough retrieved evidence to answer that question.",
                citations: [],
              },
            ],
          },
          retrieval: {
            embeddingModel: "text-embedding-3-small",
            embeddingDimensions: 1536,
            results: [],
          },
        }}
        generateAnswerError={null}
        submittedQuestion="Can this cure headaches?"
      />,
    );

    expect(
      screen.getByText(
        "I do not have enough retrieved evidence to answer that question.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("insufficient evidence")).toBeInTheDocument();
  });

  it("shows an answer error state", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        addDocumentAction={async () => {}}
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
