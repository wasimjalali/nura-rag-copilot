import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { RagVisibilityDashboard } from "./rag-visibility-dashboard";
import type { GroundedAnswerResponse } from "@/lib/rag/grounded-answer";
import { WorkspaceShell, type WorkspaceView } from "@/components/workspace/workspace-shell";
import { WorkspaceNav } from "@/components/workspace/workspace-nav";
import { Dialog } from "@/components/ui/dialog";
import { StatusLabel } from "@/components/ui/status-label";

function WorkspaceShellHarness() {
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");

  return (
    <WorkspaceShell
      activeView={activeView}
      navigation={<WorkspaceNav activeView={activeView} onSelectView={setActiveView} />}
      onSelectView={setActiveView}
    >
      <p>{activeView} content</p>
    </WorkspaceShell>
  );
}

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

const embeddingStorageStatus = {
  storedDocuments: 10,
  storedChunks: 31,
  embeddedChunks: 30,
  lastRunStatus: "failed",
  lastRunMessage: "1 chunk returned 3 dimensions.",
  lastEmbeddedAt: 1782920000000,
} as const;

const groundedAnswer: GroundedAnswerResponse = {
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
};

const followupAnswer: GroundedAnswerResponse = {
  question: "What about express shipping?",
  answer: "Express orders placed before 2 PM ship the same day. [1]",
  answerModel: "gpt-5.4-mini",
  structuredAnswer: {
    answerType: "grounded",
    paragraphs: [
      {
        text: "Express orders placed before 2 PM ship the same day.",
        citations: ["[1]"],
      },
    ],
  },
  retrieval: {
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    results: [
      {
        rank: 1,
        score: 0.72,
        chunkId: "shipping_policy__chunk_001",
        source: "shipping_policy.md",
        section: "Express",
        text: "Express orders placed before 2 PM ship the same day.",
        tokenEstimate: 9,
        citationLabel: "[1]",
      },
    ],
  },
};

const insufficientAnswer: GroundedAnswerResponse = {
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
};

const baseProps = {
  chunks,
  documents,
  addDocumentAction: async () => {},
  embedAction: async () => {},
  askAction: async () => groundedAnswer,
  embeddingStorageStatus,
};

// Type a question into the composer and submit it, the way the user does.
function askQuestion(text: string) {
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Generate answer" }));
}

describe("RagVisibilityDashboard", () => {
  it("marks the active workspace and changes views", () => {
    render(<WorkspaceShellHarness />);

    expect(screen.getByRole("button", { name: "Chat" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    fireEvent.click(screen.getByRole("button", { name: "Knowledge base" }));

    expect(
      screen.getByRole("button", { name: "Knowledge base" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("restores focus to the mobile navigation trigger when the drawer closes", () => {
    render(<WorkspaceShellHarness />);

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(trigger).toHaveFocus();
  });

  it("traps focus in the shared dialog and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog ariaLabel="Test dialog" maxWidth="max-w-lg" onClose={onClose}>
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Dialog>,
    );

    const firstAction = screen.getByRole("button", { name: "First action" });
    const lastAction = screen.getByRole("button", { name: "Last action" });
    lastAction.focus();
    fireEvent.keyDown(document, { key: "Tab" });

    expect(firstAction).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders a reusable status label", () => {
    render(<StatusLabel tone="success">Ready</StatusLabel>);

    expect(screen.getByText("Ready")).toHaveClass("text-success");
  });

  it("renders the three production workspace views and drops the learning-only ones", () => {
    render(<RagVisibilityDashboard {...baseProps} />);

    expect(
      screen.getByRole("heading", { name: "Ask a grounded question" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chat" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Knowledge base" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Evaluations" }),
    ).toBeInTheDocument();

    // The Retrieval explainer and Settings diagnostics views were removed.
    expect(screen.queryByRole("button", { name: "Retrieval" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
  });

  it("switches between the chat, knowledge and evaluations views", () => {
    render(<RagVisibilityDashboard {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Knowledge base" }));
    expect(
      screen.getByRole("heading", { name: "Knowledge base" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Evaluations" }));
    expect(
      screen.getByRole("heading", { name: "Evaluations" }),
    ).toBeInTheDocument();
  });

  it("shows documents, chunk preview and the re-embed control", () => {
    render(<RagVisibilityDashboard {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Knowledge base" }));
    expect(screen.getAllByText("return_policy.md").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("return_policy__chunk_001")).toBeInTheDocument();
    expect(screen.getAllByText("Opened Products").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Re-embed corpus" }),
    ).toBeInTheDocument();
  });

  it("offers a file upload alongside paste in the add-document dialog", () => {
    render(<RagVisibilityDashboard {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Knowledge base" }));
    fireEvent.click(screen.getByRole("button", { name: "Add document" }));

    expect(screen.getByText("Click to upload a file")).toBeInTheDocument();
    // The dialog renders through a portal to document.body, not the container.
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    expect(fileInput?.getAttribute("accept")).toContain(".pdf");
    expect(fileInput?.getAttribute("accept")).toContain(".md");
  });

  it("exposes a live eval runner instead of static passing checks", () => {
    render(<RagVisibilityDashboard {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Evaluations" }));
    expect(screen.getByRole("button", { name: "Run evals" })).toBeInTheDocument();
    expect(screen.getByText(/No run yet/)).toBeInTheDocument();
  });

  it("shows a setup state before embeddings are stored", () => {
    render(
      <RagVisibilityDashboard
        {...baseProps}
        embeddingStorageStatus={{ ...embeddingStorageStatus, embeddedChunks: 0 }}
      />,
    );

    expect(
      screen.getByText("Store and embed chunks before answer generation."),
    ).toBeInTheDocument();
  });

  it("shows a grounded answer with cited retrieved evidence", async () => {
    render(
      <RagVisibilityDashboard
        {...baseProps}
        askAction={async () => groundedAnswer}
      />,
    );

    askQuestion("Can customers return opened products?");

    expect(
      await screen.findByText("Opened products may be returned within 30 days."),
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

  it("carries the conversation so a follow-up sends prior turns as context", async () => {
    const askAction = vi.fn(async (input: { history: unknown[] }) =>
      input.history.length === 0 ? groundedAnswer : followupAnswer,
    );

    render(<RagVisibilityDashboard {...baseProps} askAction={askAction} />);

    askQuestion("Can customers return opened products?");
    await screen.findByText("Opened products may be returned within 30 days.");

    askQuestion("What about express shipping?");
    await screen.findByText(
      "Express orders placed before 2 PM ship the same day.",
    );

    // Both turns stay on screen, and the second call carried the first turn.
    expect(
      screen.getByText("Opened products may be returned within 30 days."),
    ).toBeInTheDocument();
    expect(askAction).toHaveBeenCalledTimes(2);
    const secondCall = askAction.mock.calls[1][0] as {
      question: string;
      history: { question: string; answer: string }[];
    };
    expect(secondCall.history).toHaveLength(1);
    expect(secondCall.history[0].question).toBe(
      "Can customers return opened products?",
    );
  });

  it("clears the transcript when a new chat is started", async () => {
    render(
      <RagVisibilityDashboard
        {...baseProps}
        askAction={async () => groundedAnswer}
      />,
    );

    askQuestion("Can customers return opened products?");
    await screen.findByText("Opened products may be returned within 30 days.");

    fireEvent.click(screen.getByRole("button", { name: "New chat" }));

    expect(
      screen.getByRole("heading", { name: "Ask a grounded question" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Opened products may be returned within 30 days."),
    ).toBeNull();
  });

  it("shows an insufficient-evidence answer without paragraph citations", async () => {
    render(
      <RagVisibilityDashboard
        {...baseProps}
        askAction={async () => insufficientAnswer}
      />,
    );

    askQuestion("Can this cure headaches?");

    expect(
      await screen.findByText(
        "I do not have enough retrieved evidence to answer that question.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("insufficient evidence")).toBeInTheDocument();
    // A refusal never offers a Sources control.
    expect(screen.queryByRole("button", { name: /Sources/ })).toBeNull();
  });

  it("shows an answer error state", async () => {
    render(
      <RagVisibilityDashboard
        {...baseProps}
        askAction={async () => {
          throw new Error("Answer generation failed.");
        }}
      />,
    );

    askQuestion("Can customers return opened products?");

    expect(
      await screen.findByText("Answer generation failed."),
    ).toBeInTheDocument();
  });
});
