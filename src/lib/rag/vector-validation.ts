import { EMBEDDING_DIMENSIONS } from "./embedding-config";

export function validateEmbeddingDimensions(vector: number[]) {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    return {
      ok: false,
      actualDimensions: vector.length,
      expectedDimensions: EMBEDDING_DIMENSIONS,
      message: `Expected ${EMBEDDING_DIMENSIONS} dimensions but received ${vector.length}.`,
    };
  }

  const badIndex = vector.findIndex((value) => !Number.isFinite(value));
  if (badIndex !== -1) {
    return {
      ok: false,
      actualDimensions: vector.length,
      expectedDimensions: EMBEDDING_DIMENSIONS,
      message: `Vector contains a non-finite value at index ${badIndex}.`,
    };
  }

  return {
    ok: true,
    actualDimensions: vector.length,
    expectedDimensions: EMBEDDING_DIMENSIONS,
  };
}
