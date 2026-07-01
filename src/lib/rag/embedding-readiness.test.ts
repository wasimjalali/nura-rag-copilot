import { describe, expect, it } from "vitest";

import {
  EMBEDDING_DIMENSIONS,
  embeddingConfig,
  isEmbeddingReady,
} from "./embedding-config";
import { validateEmbeddingDimensions } from "./vector-validation";

describe("embedding readiness", () => {
  it("locks the embedding model and dimensions", () => {
    expect(embeddingConfig).toEqual({
      provider: "azure-openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      deploymentEnvVar: "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
    });
  });

  it("accepts vectors with the configured dimensions", () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);

    expect(validateEmbeddingDimensions(vector)).toEqual({
      ok: true,
      actualDimensions: 1536,
      expectedDimensions: 1536,
    });
  });

  it("rejects vectors with mismatched dimensions", () => {
    expect(validateEmbeddingDimensions([0.1, 0.2, 0.3])).toEqual({
      ok: false,
      actualDimensions: 3,
      expectedDimensions: 1536,
      message: "Expected 1536 dimensions but received 3.",
    });
  });

  it("rejects vectors containing non-finite elements", () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
    vector[42] = Number.NaN;

    expect(validateEmbeddingDimensions(vector)).toEqual({
      ok: false,
      actualDimensions: EMBEDDING_DIMENSIONS,
      expectedDimensions: EMBEDDING_DIMENSIONS,
      message: "Vector contains a non-finite value at index 42.",
    });

    const infiniteVector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
    infiniteVector[7] = Number.POSITIVE_INFINITY;

    expect(validateEmbeddingDimensions(infiniteVector)).toEqual({
      ok: false,
      actualDimensions: EMBEDDING_DIMENSIONS,
      expectedDimensions: EMBEDDING_DIMENSIONS,
      message: "Vector contains a non-finite value at index 7.",
    });
  });

  it("reports readiness when the deployment name is configured", () => {
    expect(isEmbeddingReady({ AZURE_OPENAI_EMBEDDING_DEPLOYMENT: "" })).toEqual({
      ok: false,
      message:
        "Set AZURE_OPENAI_EMBEDDING_DEPLOYMENT before generating embeddings.",
    });
    expect(
      isEmbeddingReady({
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT: "text-embedding-3-small",
      }),
    ).toEqual({
      ok: true,
      message: "Embedding deployment is configured.",
    });
  });
});
