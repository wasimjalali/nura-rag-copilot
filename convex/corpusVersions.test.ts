import { describe, expect, it } from "vitest";

import {
  canReuseEmbedding,
  resolveActiveVersionAfterBuild,
  validatePromotionReadiness,
} from "./corpusVersions";

describe("corpus version helpers", () => {
  const existing = {
    textHash: "hash-1",
    chunkerVersion: "heading-v2",
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    embedding: Array.from({ length: 1536 }, () => 0.1),
  };

  it("reuses only compatible unchanged embeddings", () => {
    expect(canReuseEmbedding(existing, existing)).toBe(true);
    expect(
      canReuseEmbedding(existing, {
        ...existing,
        embeddingModel: "different-model",
      }),
    ).toBe(false);
    expect(
      canReuseEmbedding(existing, { ...existing, textHash: "hash-2" }),
    ).toBe(false);
  });

  it("keeps the active corpus unchanged when a draft fails", () => {
    expect(resolveActiveVersionAfterBuild("active-1", "failed", "draft-2")).toBe(
      "active-1",
    );
    expect(resolveActiveVersionAfterBuild("active-1", "ready", "draft-2")).toBe(
      "active-1",
    );
  });

  it("promotes only ready versions with complete vectors", () => {
    expect(() => validatePromotionReadiness("processing", 10, 10)).toThrow(
      "not ready",
    );
    expect(() => validatePromotionReadiness("ready", 9, 10)).toThrow(
      "missing embeddings",
    );
    expect(validatePromotionReadiness("ready", 10, 10)).toBeUndefined();
  });
});
