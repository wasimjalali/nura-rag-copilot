import { describe, expect, it } from "vitest";

import { formatRetrievalScore } from "./retrieval";

describe("formatRetrievalScore", () => {
  it("formats retrieval scores for compact UI display", () => {
    expect(formatRetrievalScore(0.81234)).toBe("0.812");
  });

  it("renders a placeholder for non-finite scores", () => {
    expect(formatRetrievalScore(Number.NaN)).toBe("n/a");
    expect(formatRetrievalScore(Number.POSITIVE_INFINITY)).toBe("n/a");
    expect(formatRetrievalScore(Number.NEGATIVE_INFINITY)).toBe("n/a");
  });
});
