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

describe("RagVisibilityDashboard", () => {
  it("shows documents and chunk preview details", () => {
    render(
      <RagVisibilityDashboard
        chunks={chunks}
        documents={documents}
        embeddingConfig={embeddingConfig}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "RAG visibility" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("return_policy.md")).toHaveLength(2);
    expect(screen.getByText("return_policy__chunk_001")).toBeInTheDocument();
    expect(screen.getByText("Opened Products")).toBeInTheDocument();
    expect(
      screen.getByText(/This is what will be embedded next/),
    ).toBeInTheDocument();
    expect(screen.getByText("text-embedding-3-small")).toBeInTheDocument();
    expect(screen.getByText("1536 dimensions")).toBeInTheDocument();
    expect(
      screen.getByText(/Human review comes before embedding/),
    ).toBeInTheDocument();
  });
});
