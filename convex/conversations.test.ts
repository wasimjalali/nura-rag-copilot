import { describe, expect, it } from "vitest";

import { deriveServerConversationTitle, trimStoredHistory } from "./conversations";

describe("conversation helpers", () => {
  it("derives a bounded title from the first question", () => {
    expect(deriveServerConversationTitle("  Can   I return an opened product?  ")).toBe(
      "Can I return an opened product?",
    );
    expect(deriveServerConversationTitle("x".repeat(80))).toHaveLength(60);
  });

  it("keeps only the newest bounded completed history", () => {
    const history = Array.from({ length: 8 }, (_, index) => ({
      question: `Question ${index}`,
      answer: `Answer ${index}`,
    }));
    expect(trimStoredHistory(history, 3, 10_000)).toEqual(history.slice(-3));
  });
});
