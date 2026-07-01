import { describe, expect, it } from "vitest";

import {
  INSUFFICIENT_EVIDENCE_ANSWER,
  addCitationLabels,
  buildGroundedAnswerMessages,
  formatEvidenceForPrompt,
} from "./groundedAnswer";

const retrievalResults = [
  {
    rank: 1,
    score: 0.7072184,
    chunkId: "return_policy__chunk_002",
    source: "return_policy.md",
    section: "Standard Return Window",
    text: "Opened products may be returned within 30 days when the customer tried the product and is unsatisfied.",
    tokenEstimate: 42,
  },
  {
    rank: 2,
    score: 0.5128461,
    chunkId: "return_policy__chunk_004",
    source: "return_policy.md",
    section: "Non-Returnable Orders",
    text: "Final-sale bundles are not eligible for standard returns.",
    tokenEstimate: 24,
  },
];

describe("grounded answer helpers", () => {
  it("adds stable citation labels based on rank", () => {
    expect(addCitationLabels(retrievalResults)).toEqual([
      {
        ...retrievalResults[0],
        citationLabel: "[1]",
      },
      {
        ...retrievalResults[1],
        citationLabel: "[2]",
      },
    ]);
  });

  it("formats cited evidence for the prompt", () => {
    const evidence = formatEvidenceForPrompt(addCitationLabels(retrievalResults));

    expect(evidence).toContain("[1] return_policy.md > Standard Return Window");
    expect(evidence).toContain("Chunk ID: return_policy__chunk_002");
    expect(evidence).toContain("Score: 0.707");
    expect(evidence).toContain("Opened products may be returned within 30 days");
  });

  it("builds strict grounded-answer messages", () => {
    const messages = buildGroundedAnswerMessages(
      "Can a customer return an opened product?",
      addCitationLabels(retrievalResults),
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      role: "system",
      content: expect.stringContaining(
        "Answer only from the provided evidence.",
      ),
    });
    expect(messages[0].content).toContain("Do not invent policies");
    expect(messages[1].content).toContain(
      "Question: Can a customer return an opened product?",
    );
    expect(messages[1].content).toContain(
      "[1] return_policy.md > Standard Return Window",
    );
  });

  it("provides a stable insufficient-evidence answer", () => {
    expect(INSUFFICIENT_EVIDENCE_ANSWER).toBe(
      "I do not have enough retrieved evidence to answer that question.",
    );
  });
});
