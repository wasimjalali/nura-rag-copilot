import { describe, expect, it } from "vitest";

import { chunkDocuments, estimateTokenCount } from "./chunk";
import { loadSyntheticDocuments } from "./load-documents";

describe("RAG preview document loading and chunking", () => {
  it("loads the ten synthetic source documents", async () => {
    const documents = await loadSyntheticDocuments();

    expect(documents).toHaveLength(10);
    expect(documents.map((doc) => doc.source).sort()).toEqual([
      "allergen_policy.md",
      "discount_refund_approval_rules.md",
      "health_claims_compliance.md",
      "ingredient_glossary.md",
      "product_catalog.md",
      "return_policy.md",
      "shipping_policy.md",
      "subscription_policy.md",
      "supplement_usage_faq.md",
      "support_escalation_sop.md",
    ]);
    expect(documents[0]).toEqual(
      expect.objectContaining({
        source: expect.stringMatching(/\.md$/),
        title: expect.any(String),
        text: expect.stringContaining("##"),
      }),
    );
  });

  it("creates stable heading-aware chunks", async () => {
    const chunks = chunkDocuments(await loadSyntheticDocuments());

    expect(chunks.length).toBeGreaterThan(20);
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        id: "allergen_policy__chunk_001",
        source: "allergen_policy.md",
        section: expect.any(String),
        text: expect.any(String),
        tokenEstimate: expect.any(Number),
        createdAt: "2026-07-01T00:00:00.000Z",
      }),
    );
    expect(chunks.every((chunk) => chunk.text.trim().length > 0)).toBe(true);
    expect(chunks.every((chunk) => chunk.tokenEstimate > 0)).toBe(true);
    expect(
      chunks.some((chunk) => chunk.section === "Customer-Facing Guidance"),
    ).toBe(true);
  });

  it("estimates token count from words", () => {
    expect(estimateTokenCount("alpha beta gamma delta")).toBe(6);
  });
});
