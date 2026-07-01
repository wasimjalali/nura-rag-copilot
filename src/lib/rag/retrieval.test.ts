import { describe, expect, it } from "vitest";

import {
  buildRetrievalResults,
  clampRetrievalLimit,
  formatRetrievalScore,
  validateRetrievalQuestion,
} from "./retrieval";

describe("retrieval helpers", () => {
  it("normalizes a non-empty question and rejects blank questions", () => {
    expect(validateRetrievalQuestion("  What is the return window?  ")).toBe(
      "What is the return window?",
    );

    expect(() => validateRetrievalQuestion("   ")).toThrow(
      "Enter a question to retrieve evidence.",
    );
  });

  it("clamps retrieval result limits to a small predictable range", () => {
    expect(clampRetrievalLimit()).toBe(5);
    expect(clampRetrievalLimit(0)).toBe(1);
    expect(clampRetrievalLimit(7.8)).toBe(7);
    expect(clampRetrievalLimit(40)).toBe(10);
  });

  it("maps vector search scores and chunk records into ranked results", () => {
    const results = buildRetrievalResults(
      [
        { id: "chunk-a", score: 0.81234 },
        { id: "missing", score: 0.7 },
        { id: "chunk-b", score: 0.51234 },
      ],
      new Map([
        [
          "chunk-a",
          {
            chunkId: "chunk-a",
            source: "returns.md",
            section: "Opened Items",
            text: "Opened products can be returned in the policy window.",
            tokenEstimate: 12,
          },
        ],
        [
          "chunk-b",
          {
            chunkId: "chunk-b",
            source: "shipping.md",
            section: "Delays",
            text: "Shipping delays are handled by the support team.",
            tokenEstimate: 10,
          },
        ],
      ]),
    );

    expect(results).toEqual([
      {
        rank: 1,
        score: 0.81234,
        chunkId: "chunk-a",
        source: "returns.md",
        section: "Opened Items",
        text: "Opened products can be returned in the policy window.",
        tokenEstimate: 12,
      },
      {
        rank: 2,
        score: 0.51234,
        chunkId: "chunk-b",
        source: "shipping.md",
        section: "Delays",
        text: "Shipping delays are handled by the support team.",
        tokenEstimate: 10,
      },
    ]);
  });

  it("formats retrieval scores for compact UI display", () => {
    expect(formatRetrievalScore(0.81234)).toBe("0.812");
  });
});
