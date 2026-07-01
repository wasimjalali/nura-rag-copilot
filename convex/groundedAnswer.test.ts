import { describe, expect, it } from "vitest";

import {
  INSUFFICIENT_EVIDENCE_ANSWER,
  addCitationLabels,
  buildInsufficientEvidenceAnswer,
  buildGroundedAnswerMessages,
  formatEvidenceForPrompt,
  parseStructuredGroundedAnswer,
  structuredAnswerToText,
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
    expect(messages[0].content).toContain("Return only JSON");
    expect(messages[0].content).toContain("answerType");
    expect(messages[0].content).toContain("paragraphs");
    expect(messages[0].content).toContain("citations");
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

  it("builds a structured insufficient-evidence answer", () => {
    expect(buildInsufficientEvidenceAnswer()).toEqual({
      answerType: "insufficient_evidence",
      paragraphs: [
        {
          text: INSUFFICIENT_EVIDENCE_ANSWER,
          citations: [],
        },
      ],
    });
  });

  it("parses valid structured grounded JSON", () => {
    const parsed = parseStructuredGroundedAnswer(
      JSON.stringify({
        answerType: "grounded",
        paragraphs: [
          {
            text: "Opened products may be returned within 30 days.",
            citations: ["[1]"],
          },
        ],
      }),
      addCitationLabels(retrievalResults),
    );

    expect(parsed).toEqual({
      answerType: "grounded",
      paragraphs: [
        {
          text: "Opened products may be returned within 30 days.",
          citations: ["[1]"],
        },
      ],
    });
  });

  it("removes duplicate paragraph citations while preserving order", () => {
    const parsed = parseStructuredGroundedAnswer(
      JSON.stringify({
        answerType: "grounded",
        paragraphs: [
          {
            text: "Opened products may be returned within 30 days.",
            citations: ["[1]", "[1]", "[2]"],
          },
        ],
      }),
      addCitationLabels(retrievalResults),
    );

    expect(parsed.paragraphs[0].citations).toEqual(["[1]", "[2]"]);
  });

  it("falls back when JSON is invalid", () => {
    const parsed = parseStructuredGroundedAnswer(
      "not json",
      addCitationLabels(retrievalResults),
    );

    expect(parsed).toEqual(buildInsufficientEvidenceAnswer());
  });

  it("falls back when grounded paragraphs omit citations", () => {
    const parsed = parseStructuredGroundedAnswer(
      JSON.stringify({
        answerType: "grounded",
        paragraphs: [{ text: "Opened products may be returned.", citations: [] }],
      }),
      addCitationLabels(retrievalResults),
    );

    expect(parsed).toEqual(buildInsufficientEvidenceAnswer());
  });

  it("falls back when citations were not retrieved", () => {
    const parsed = parseStructuredGroundedAnswer(
      JSON.stringify({
        answerType: "grounded",
        paragraphs: [
          { text: "Opened products may be returned.", citations: ["[9]"] },
        ],
      }),
      addCitationLabels(retrievalResults),
    );

    expect(parsed).toEqual(buildInsufficientEvidenceAnswer());
  });

  it("converts structured paragraphs back to readable text", () => {
    expect(
      structuredAnswerToText({
        answerType: "grounded",
        paragraphs: [
          {
            text: "Opened products may be returned within 30 days.",
            citations: ["[1]"],
          },
          {
            text: "Orders outside the window are not eligible.",
            citations: ["[2]"],
          },
        ],
      }),
    ).toBe(
      [
        "Opened products may be returned within 30 days. [1]",
        "Orders outside the window are not eligible. [2]",
      ].join("\n\n"),
    );
  });
});
