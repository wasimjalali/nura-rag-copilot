import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KnowledgeWorkspace } from "./knowledge-workspace";

const documents = [
  {
    source: "return_policy.md",
    title: "Return Policy",
    text: "# Return Policy\n\n## Eligibility\nReturns are accepted within 30 days.",
  },
  {
    source: "shipping_policy.md",
    title: "Shipping Policy",
    text: "# Shipping Policy\n\n## Delivery\nStandard shipping takes five days.",
  },
];

const chunks = [
  {
    id: "return_policy__chunk_001",
    source: "return_policy.md",
    section: "Eligibility",
    text: "Returns are accepted within 30 days.",
    tokenEstimate: 7,
    createdAt: "2026-07-01T00:00:00.000Z",
  },
];

const embeddingStorageStatus = {
  storedDocuments: 2,
  storedChunks: 1,
  embeddedChunks: 1,
  lastRunStatus: "succeeded",
  lastRunMessage: "All chunks embedded.",
  lastEmbeddedAt: 1782920000000,
} as const;

describe("KnowledgeWorkspace", () => {
  it("filters documents by title, source and status", () => {
    render(
      <KnowledgeWorkspace
        addDocumentAction={async () => {}}
        chunks={chunks}
        documents={documents}
        embedAction={async () => {}}
        embeddingStorageStatus={embeddingStorageStatus}
      />,
    );

    const table = screen.getByRole("table", { name: "Knowledge documents" });
    const search = screen.getByRole("searchbox", { name: "Search documents" });

    fireEvent.change(search, { target: { value: "return" } });
    expect(within(table).getByRole("row", { name: /Return Policy/ })).toBeInTheDocument();
    expect(
      within(table).queryByRole("row", { name: /Shipping Policy/ }),
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "shipping_policy.md" } });
    expect(within(table).getByRole("row", { name: /Shipping Policy/ })).toBeInTheDocument();
    expect(
      within(table).queryByRole("row", { name: /Return Policy/ }),
    ).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Filter by status"), {
      target: { value: "needs_indexing" },
    });
    expect(within(table).getByRole("row", { name: /Shipping Policy/ })).toBeInTheDocument();
    expect(
      within(table).queryByRole("row", { name: /Return Policy/ }),
    ).not.toBeInTheDocument();
  });

  it("opens a document detail panel with ingestion status", () => {
    render(
      <KnowledgeWorkspace
        addDocumentAction={async () => {}}
        chunks={chunks}
        documents={documents}
        embedAction={async () => {}}
        embeddingStorageStatus={embeddingStorageStatus}
      />,
    );

    const table = screen.getByRole("table", { name: "Knowledge documents" });
    fireEvent.click(
      within(table).getByRole("button", { name: "View Return Policy" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Return Policy details" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Active")).toBeInTheDocument();
    expect(within(dialog).getByText("1 indexed chunk")).toBeInTheDocument();
  });
});
